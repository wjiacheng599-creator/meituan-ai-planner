import { getActivityImage, getFeedImage } from '../imageLibrary';
import { batchFetchPOIImages } from '../poiImageService';
import { generatePlanViaServer, generatePlanStream } from '../serverApi';
import { dataSource } from '../apiAdapter';
import { isBrowserRuntime } from '../runtimeEnv';
import { seededInt } from '../../utils/seededRandom';
import { getUserPreferences } from '../userPreference';
import { optimizeActivitiesWithConstraints } from '../routeOptimizer';
import { allocateTimeWithRealMap } from '../timeAllocator';
import { decideLodgingNeed, parseLodgingKeywords } from '../lodgingStrategy';
import { Activity, Plan, type PlanningContext } from './types';
import type { PersonProfile } from '../../types';
import { sanitizeUserInput, callDashScope, callDashScopeStreaming } from './core';
import { cachedSearchPOI } from './cache';
import { getUserCity } from './weather';
import { dnaToPromptContext, type TravelDNA } from './travelDNA';
import { generateMockPlan, generateFallbackUIStrategy } from './mockData';
import { inferSearchKeywords, fallbackImages, formatPoiDistance } from './utils';
import { buildUnifiedProfile, profileToPromptContext } from './unifiedProfile';
import {
  rankPOIs,
  applyDiversityControl,
  rankedPOIsToPromptContext,
  type RankedPOI,
} from './poiRanking';
import { extractConstraints, constraintsToPromptContext } from './constraintExtractor';
import { validatePlan, validationToUserMessage } from './planValidator';
import { searchCandidates } from './candidateSearch';
import { solveConstraints } from './constraintSolver';

async function enrichActivitiesWithImages(
  activities: Activity[],
  city?: string
): Promise<Activity[]> {
  const items = activities
    .filter((a) => a.type !== 'travel')
    .map((a) => ({
      name: a.title,
      city,
      location: a.lat != null && a.lng != null ? { lng: a.lng, lat: a.lat } : undefined,
      photos: a.poiPhotos,
      poiId: a.poiId,
    }));

  if (items.length === 0) return activities;

  try {
    const imageMap = await batchFetchPOIImages(items);
    return activities.map((a) => {
      if (a.type === 'travel') return a;
      const realUrl = imageMap.get(a.title);
      return realUrl ? { ...a, imageUrl: realUrl } : a;
    });
  } catch {
    return activities;
  }
}

async function enrichPlanImages(plan: Plan, city?: string): Promise<Plan> {
  const enrichedActivities = await enrichActivitiesWithImages(plan.activities, city);

  let enrichedBudgetOptions = plan.budgetOptions;
  if (plan.budgetOptions?.length) {
    enrichedBudgetOptions = await Promise.all(
      plan.budgetOptions.map(async (opt) => {
        if (!opt.activities?.length) return opt;
        return { ...opt, activities: await enrichActivitiesWithImages(opt.activities, city) };
      })
    );
  }

  return { ...plan, activities: enrichedActivities, budgetOptions: enrichedBudgetOptions };
}

/** 从服务端拉取用户偏好 + 行为事件，构建统一画像上下文 */
async function buildUnifiedProfileContext(travelDNA?: TravelDNA | null): Promise<string> {
  try {
    // 1. 获取用户偏好
    const userPrefs = await getUserPreferences();

    // 2. 获取行为事件
    let behaviorEvents: Array<{
      id: string;
      type: string;
      planId: string | null;
      activityId: string | null;
      metadata: Record<string, unknown>;
      timestamp: number;
    }> = [];
    try {
      const res = await fetch('/api/behavior/stats', { credentials: 'include' });
      if (res.ok) {
        // 从 stats 中获取事件（简化版，完整版需要单独的 API）
        const stats = await res.json();
        // 构建简化的行为洞察
        if (stats.totalEvents > 0) {
          const insights: string[] = [];
          if (stats.byType.search > 5) insights.push('你是活跃用户，经常搜索行程');
          if (stats.byType.complete > 3) insights.push('你完成率较高，推荐时会考虑可行性');
          return insights.length > 0
            ? `\n【行为洞察】\n${insights.map((i) => `- ${i}`).join('\n')}\n`
            : '';
        }
      }
    } catch {
      /* 行为数据获取失败不影响主流程 */
    }

    // 3. 构建统一画像
    const profile = buildUnifiedProfile({
      travelDNA: travelDNA || null,
      userPreference: userPrefs,
      behaviorEvents,
    });

    // 4. 转换为 prompt 上下文
    const profileContext = profileToPromptContext(profile);

    // 5. 合并用户偏好
    const prefsContext = await buildPrefsContext();

    return `${profileContext}\n${prefsContext}`;
  } catch {
    /* 画像构建失败不影响主流程 */
  }
  return '';
}

/** 从服务端拉取用户偏好，构建 prompt 上下文（保留兼容） */
async function buildPrefsContext(): Promise<string> {
  try {
    const userPrefs = await getUserPreferences();
    if (!userPrefs) return '';
    const parts: string[] = [];
    if (userPrefs.favoriteCategories.length > 0)
      parts.push(`喜欢: ${userPrefs.favoriteCategories.join('、')}`);
    if (userPrefs.avoidCategories.length > 0)
      parts.push(`回避: ${userPrefs.avoidCategories.join('、')}`);
    if (userPrefs.dietaryRestrictions.length > 0)
      parts.push(`忌口/饮食限制: ${userPrefs.dietaryRestrictions.join('、')}`);
    if (userPrefs.priceRange.max < 1000)
      parts.push(`预算范围: ¥${userPrefs.priceRange.min}-${userPrefs.priceRange.max}/人`);
    if (userPrefs.preferredTime !== 'any') {
      const timeMap: Record<string, string> = {
        morning: '上午',
        afternoon: '下午',
        evening: '晚上',
      };
      parts.push(`偏好时段: ${timeMap[userPrefs.preferredTime] || userPrefs.preferredTime}`);
    }
    if (parts.length > 0) {
      return `\n【用户历史偏好】${parts.join('；')}\n请参考这些偏好来规划行程，但不必完全受限。\n`;
    }
  } catch {
    /* 偏好拉取失败不影响主流程 */
  }
  return '';
}

/** 对 POI 搜索结果进行个性化排序 */
async function rankSearchResults(
  pois: Array<{
    name: string;
    type: string;
    address?: string;
    distance?: string;
    rating?: string;
    cost?: string;
  }>,
  city: string
): Promise<RankedPOI[]> {
  try {
    const userPrefs = await getUserPreferences();
    const profile = buildUnifiedProfile({
      travelDNA: null,
      userPreference: userPrefs,
      behaviorEvents: [],
    });
    const ranked = rankPOIs(pois, profile, { city });
    return applyDiversityControl(ranked, pois.length);
  } catch {
    // 排序失败时返回原始顺序
    return pois.map((p) => ({
      ...p,
      personalScore: 50,
      diversityScore: 50,
      finalScore: 50,
      matchReasons: [],
    }));
  }
}

// [PERF-OPT] Modified to support cachedSearchPOI for deduplication
async function buildPlanFromPOI(query: string, city: string): Promise<Plan | null> {
  const keywords = inferSearchKeywords(query);

  // 根据用户需求动态调整数量："深度/丰富/充实"=更多，"随便/简单/逛逛"=更少
  const isDeep = /深度|丰富|充实|满满|充分|一整天|全天/.test(query);
  const isLight = /随便|简单|逛逛|随便走走|透透气|溜达/.test(query);
  const foodCount = isDeep ? 3 : isLight ? 1 : 2;
  const activityCount = isDeep ? 2 : isLight ? 0 : 1;

  const [foodPois, activityPois] = await Promise.all([
    cachedSearchPOI(keywords.food, city, 5000),
    cachedSearchPOI(keywords.activity, city, 5000),
  ]);

  const foodSpots = foodPois.slice(0, foodCount);
  const activitySpots = activityPois.slice(0, activityCount);

  if (foodSpots.length === 0 && activitySpots.length === 0) {
    return null;
  }

  const activities: Activity[] = [];

  foodSpots.forEach((spot, i) => {
    activities.push({
      id: String(activities.length + 1),
      timeLine: i === 0 ? '14:00-15:10' : i === 1 ? '17:30-19:00' : '20:00-21:30',
      title: spot.name,
      type: 'food',
      description:
        i === 0
          ? `先在 ${spot.name} 落座，方便慢慢进入状态。`
          : `最后在 ${spot.name} 收尾，更适合延续聊天或直接用餐。`,
      price: Number(spot.cost || (i === 0 ? 68 : 98)) || (i === 0 ? 68 : 98),
      imageUrl:
        spot.photos && spot.photos.length > 0
          ? spot.photos[0]
          : getFeedImage(`${spot.name} ${spot.type} ${city}`, `plan_poi_food_${i}`),
      distanceInfo: `${spot.address || city} · ${formatPoiDistance(spot.distance)}`,
      poiPhotos: spot.photos,
      poiId: spot.id,
      tags: i === 0 ? ['真实地点', '适合开场'] : ['真实地点', '顺路收尾'],
      reasoning:
        i === 0
          ? '优先选择当前城市内可直接到达的真实门店，降低决策成本。'
          : '把吃喝与逛的节奏拆开，用户执行时更自然。',
      teamFit:
        i === 0
          ? '适合先集合、先休息或边聊边定后续节奏。'
          : '适合约会、朋友局，也适合一个人慢慢待到傍晚。',
    });
  });

  activitySpots.forEach((spot) => {
    activities.push({
      id: String(activities.length + 1),
      timeLine: '15:30-17:10',
      title: spot.name,
      type: 'activity',
      description: `中段安排到 ${spot.name} 逛逛，形成更完整的本地生活路线。`,
      price: Number(spot.cost || 88) || 88,
      imageUrl:
        spot.photos && spot.photos.length > 0
          ? spot.photos[0]
          : getFeedImage(
              `${spot.name} ${spot.type} ${city}`,
              `plan_poi_activity_${activities.length}`
            ),
      distanceInfo: `${spot.address || city} · ${formatPoiDistance(spot.distance)}`,
      poiPhotos: spot.photos,
      poiId: spot.id,
      tags: ['真实地点', '可执行'],
      reasoning: '优先选同城高相关 POI，让路线更像真实可出发的半日方案。',
      teamFit: '适合拍照、散步或补充轻量活动内容。',
    });
  });

  if (activities.length === 0) return null;

  const enrichedActivities = await enrichActivitiesWithImages(activities, city);
  const totalPrice = enrichedActivities.reduce((sum, item) => sum + item.price, 0);

  return {
    id: `plan_${Date.now()}`,
    title: `${city}${/约会/.test(query) ? '轻松约会线' : /亲子|家庭/.test(query) ? '半日陪伴线' : '半日可出发路线'}`,
    durationTags: enrichedActivities.length >= 3 ? '约4.5小时' : '约3小时',
    tags: [/咖啡|下午茶/.test(query) ? '咖啡放松' : '本地生活', '真实地点', '可直接出发'],
    summary: `围绕 ${city} 当前可检索到的真实地点，整理成一条更容易直接执行的路线。`,
    city,
    date: new Date()
      .toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      .replace('/', '-'),
    activities: enrichedActivities,
    totalPrice,
    strategy: '优先使用同城真实地点组织路线',
    conflictResolution: '个人出行',
    uiStrategy: generateFallbackUIStrategy({
      id: `plan_${Date.now()}`,
      title: activities.length >= 3 ? `${city}轻松约会线` : `${city}半日可出发路线`,
      durationTags: activities.length >= 3 ? '约4.5小时' : '约3小时',
      tags: [/咖啡|下午茶/.test(query) ? '咖啡放松' : '本地生活', '真实地点', '可直接出发'],
      summary: '',
      city,
      date: '',
      activities,
      totalPrice,
      strategy: '',
      conflictResolution: '',
    } as any),
  };
}

export async function generatePlanLocally(
  query: string,
  cityParam?: string,
  signal?: AbortSignal,
  travelDNA?: TravelDNA,
  context?: PlanningContext
): Promise<Plan> {
  if (signal?.aborted) {
    throw new Error('AbortError');
  }

  try {
    // Sanitize user input to prevent prompt injection
    query = sanitizeUserInput(query);

    const userCity = cityParam || (await getUserCity());
    console.log('[generatePlanLocally] 开始，userCity:', userCity, 'hasAmap:', dataSource.hasAmap);

    // 阶段 1：约束提取（纯规则，不依赖 LLM）
    const constraints = extractConstraints(
      query,
      (context?.profiles || []) as PersonProfile[],
      context?.timePref
    );
    const constraintsContext = constraintsToPromptContext(constraints);
    console.log(
      '[generatePlanLocally] 约束提取完成，意图:',
      constraints.intent,
      '时间:',
      constraints.timeWindow.start + '-' + constraints.timeWindow.end
    );

    // 阶段 2：并行候选搜索
    let candidateContext = '';
    let allKnownPOIs: Array<{
      id?: string;
      name: string;
      type: string;
      address?: string;
      lat?: number;
      lng?: number;
      rating?: string;
      cost?: string;
    }> = [];
    // 从 travelDNA 构建用户画像用于候选排序
    const userProfileForSearch = travelDNA
      ? buildUnifiedProfile({ travelDNA, userPreference: null, behaviorEvents: [] })
      : undefined;
    try {
      const candidates = await searchCandidates(constraints, userCity, userProfileForSearch);
      if (candidates.promptContext) {
        candidateContext = candidates.promptContext;
        console.log('[generatePlanLocally] 候选搜索完成:', candidates.searchSummary);
      }
      // 候选搜索的 POI 也加入已知池（用于后续校验）
      for (const c of [...candidates.foodCandidates, ...candidates.activityCandidates]) {
        if (!allKnownPOIs.some((p) => p.name === c.name)) {
          allKnownPOIs.push({
            name: c.name,
            type: c.type,
            address: c.address,
            rating: c.rating,
            cost: c.cost,
          });
        }
      }
    } catch (err) {
      console.warn('[generatePlanLocally] 候选搜索失败，使用默认 POI:', err);
    }

    // 始终尝试获取真实POI数据
    let poiContext = '';

    if (dataSource.hasAmap) {
      try {
        const keywords = inferSearchKeywords(query);

        // [PERF-OPT] Use cached search to avoid duplicate API calls
        const [foodPois, activityPois] = await Promise.all([
          cachedSearchPOI(keywords.food, userCity, 5000),
          cachedSearchPOI(keywords.activity, userCity, 5000),
        ]);
        // 合并到已知 POI 池（候选搜索的 POI 保留）
        for (const poi of [...foodPois, ...activityPois]) {
          if (!allKnownPOIs.some((p) => p.name === poi.name)) {
            allKnownPOIs.push(poi);
          }
        }

        const hasValidPoiData = foodPois.length > 0 || activityPois.length > 0;
        console.log(
          '[generatePlanLocally] POI搜索: 餐饮=' + foodPois.length + ' 活动=' + activityPois.length
        );

        if (hasValidPoiData) {
          // 构建 POI 上下文注入 AI（而非跳过 AI）
          const foodList = foodPois
            .slice(0, 5)
            .map(
              (p, i) =>
                `${i + 1}. ${p.name} - ${p.type} - ${p.address || '地址未知'} - 评分${p.rating || '?'}`
            )
            .join('\n');
          const activityList = activityPois
            .slice(0, 5)
            .map(
              (p, i) =>
                `${i + 1}. ${p.name} - ${p.type} - ${p.address || '地址未知'} - 评分${p.rating || '?'}`
            )
            .join('\n');
          poiContext = `
【真实POI数据】这些是${userCity}的真实商家/景点，你必须从中选择：
餐饮推荐：
${foodList || '暂无数据'}

活动景点：
${activityList || '暂无数据'}

重要：你必须从上面的真实POI中选择地点名称，不得虚构地点！`;
          console.log(
            '[generatePlanLocally] ✅ POI上下文已注入AI，包含',
            foodPois.length,
            '个餐饮和',
            activityPois.length,
            '个活动'
          );
        } else {
          console.warn('[generatePlanLocally] ⚠️ 未找到POI数据');
        }
      } catch (error) {
        console.error('[generatePlanLocally] POI搜索失败:', error);
      }
    } else {
      console.warn('[generatePlanLocally] ⚠️ hasAmap=false，AI 将在无真实POI数据的情况下生成');
      poiContext = `
⚠️ 当前无法获取${userCity}的真实POI数据。你必须：
1. 基于你的训练知识推荐具体、真实存在的地点名称
2. 为每个地点标注 [AI推荐]
3. 不要编造虚假店铺名，使用真实存在的知名景点/餐厅`;
    }

    const dnaContext =
      travelDNA && travelDNA.meta.confidence > 0.2 ? `\n${dnaToPromptContext(travelDNA)}\n` : '';

    // 使用统一画像（合并 travelDNA + userPreference + 行为事件）
    const unifiedProfileContext = await buildUnifiedProfileContext(travelDNA);
    const prefsContext = unifiedProfileContext || (await buildPrefsContext());

    // 构建天气上下文
    const weatherContext = context?.weather
      ? `\n【实时天气】${context.weather.city} ${context.weather.temp}°C ${context.weather.condition}。${context.weather.advice}\n`
      : '';

    // 构建协作上下文
    let collabContext = '';
    if (context?.collaboration) {
      const c = context.collaboration;
      const parts: string[] = [`协调策略：${c.strategyLabel}`];
      if (c.consensus.length) parts.push(`共识：${c.consensus.join('、')}`);
      if (c.conflicts.length) parts.push(`分歧：${c.conflicts.join('、')}`);
      if (c.topAvoids?.length) parts.push(`共同避雷：${c.topAvoids.join('、')}`);
      if (c.tieBreakerLabel) parts.push(`裁决方式：${c.tieBreakerLabel}`);
      collabContext = `\n【多人协作】${parts.join('。')}\n`;
    }

    const memberInfo =
      context?.memberCount && context.memberCount > 1
        ? `本次出行共 ${context.memberCount} 人，请注意活动安排要适合所有人。`
        : '';

    const systemPrompt = `你是一个专业的美团本地生活规划师，同时也是多人关系协调专家。用户当前所在城市：${userCity}。用户想要一个周末/下午的短途出行计划。
${dnaContext}${prefsContext}${weatherContext}${collabContext}
${constraintsContext}
${memberInfo}
根据用户需求生成完整、可执行的方案。所有推荐的地点必须在${userCity}市或其周边区域。
${poiContext}
${candidateContext}

⚠️ 重要：这是一个单日出行计划，所有活动必须在同一天内完成，不要生成多天行程。除非用户明确说"两天"、"三天"、"多日"，否则所有活动的时间线都安排在同一天。

⚠️ 目标推理（Goal Reasoning）— 在生成行程前，你必须先理解用户的真实目标：
1. **表层目标**：用户直接说的（如"出去玩"）
2. **深层目标**：用户真正想要的（如"家庭陪伴"、"增进感情"、"放松减压"）
3. **情感需求**：用户未说出口的（如"让父母开心"、"创造浪漫回忆"、"展示品味"）
4. **推荐策略**：基于目标推导的选点原则（如"优先安静有座位"、"安排拍照点"、"避免尴尬"）
请结合用户输入、同行人画像、用户偏好、对话语境，综合推理真实目标。不要只看表面关键词。

活动数量策略（根据用户需求智能调整）：
- "深度体验"/"满满一天"/"全天" → 优先安排 4-5 个活动，确保行程充实饱满
- "随便逛逛"/"简单"/"透透气" → 2-3 个活动，轻松不赶
- 约会/浪漫场景 → 3 个活动（1-2个餐饮 + 1个体验活动，如散步/展览/拍照点），节奏舒缓
- 默认 → 3 个活动，根据场景灵活调整
- 如果候选POI充足且用户意图明确追求充实，可适当增加到 5 个

餐饮分配规则（智能适配）：
- 一般场景建议每天安排 1 次咖啡/下午茶/饮品类活动，保留 1 个正餐
- 美食探索场景：如果用户明确以"吃"为主，可以多安排餐饮，但需选择不同类型和品牌
- 约会场景：建议餐饮与体验活动穿插（如咖啡→展览→晚餐），避免全是餐饮
- 2个餐饮时：建议至少1个正餐，另1个可以是正餐或咖啡/下午茶
- 3个餐饮时：建议至少2个正餐，最多1个咖啡/下午茶
- 正餐指有主食的餐饮（如火锅、烧烤、面馆、餐厅等），咖啡/甜品/奶茶不算正餐

如果用户提供了【同行人】信息和【决策策略】，你必须：
1. 深度分析每个人的偏好、年龄、忌口、体力限制
2. 根据【决策策略】平衡各方需求
3. 为每个活动说明"为什么选这里"（关联到具体人的需求和深层目标）
4. 如有偏好冲突，在 conflictResolution 中说明如何调和

tieBreaker（冲突裁决）强制执行规则：
- "照顾老人优先" → 排除需要大量步行、爬楼梯、长时间站立的场所，优先安静、有座位的
- "儿童优先" → 排除酒吧、夜店等成人场所，优先有互动区、游乐设施的
- "民主共识" → 每个活动至少被2人偏好，否则换替代
- "效率优先" → 间距不超过5km，减少交通时间

时间策略强制执行规则（根据同行人特征自动适配）：
- 有儿童（≤6岁）：每个活动不超过 2 小时，活动之间必须有 15-20 分钟休息间隔，避免需要大量步行/爬山的场所，优先室内游乐、亲子互动
- 有老人/体力受限者：活动时长不超过 1.5 小时，必须有座位休息点，避免连续站立超过 30 分钟
- 有减肥/低卡需求者：餐厅优先安排轻食/沙拉/低卡选项，避免在高强度活动后安排大餐，可安排下午茶代替正餐
- 总时长 4-6 小时：安排 3-4 个活动（含餐饮），每个活动 1-2 小时，预留交通和缓冲时间
- 活动顺序建议：轻体力（咖啡/展览）→ 中体力（亲子乐园/购物）→ 餐饮 → 轻体力（散步/公园）

如果只有一个人出行，也要在 strategy 中简要说明规划思路（如"根据个人偏好精选"），conflictResolution 写"个人出行"。

必须包含：
- 标题：描述性标题
- durationTags：时长描述如"约5.5小时"
- tags：2-3个标签如"家庭亲子", "轻松减压"
- summary：一句话总结
- city：用户所在城市"${userCity}"（除非用户明确指定了其他城市）
- strategy：必填，使用的决策策略说明（如"民主共识"、"优先照顾老人"或"根据个人偏好精选"）
- conflictResolution：必填，如果有多人需求冲突说明如何调和（如"选择了鸳鸯锅满足不吃辣的小美和爱辣的爸爸"），无冲突则写"全员偏好一致"或"个人出行"
- activities：活动数组，每个活动包含：
  - id：自增字符串 "1", "2", "3"...
  - timeLine：时间如 "14:30-16:30"
  - title：具体地点名称（必须使用上面提供的真实POI名称）
  - type："activity" | "food" | "travel"
  - description：为什么去这里
  - price：预估人民币价格（纯数字）
  - distanceInfo：如 "距离 2.5km"
  - tags：2-3个标签
  - reasoning：必填，选择这个地点的原因（如"适合拍照打卡"或"小红喜欢拍照，这家咖啡馆有网红打卡墙"）
  - teamFit：必填，适配度说明（如"适合所有人"或"孩子会喜欢这里的互动区"）
- totalPrice：总价格（标准版）
- budgetOptions：预算版本数组，包含 3 个版本，每个版本必须有不同的活动方案：
  - 经济版：选择免费/低价场所（公园、免费展览、平价小吃街），人均约节省 30-40%
  - 标准版：平衡体验和价格（中档餐厅、常规景点），匹配用户预算
  - 品质版：选择高端场所（精品餐厅、VIP体验、特色高端活动），人均约增加 50-80%
  - 每个版本包含 {label, perPerson, total, strategy, activities}，activities 是该版本的活动列表
  - activities 中每个活动包含 {title, type, timeLine, price, description}
  - 三个版本的活动方案必须有明显差异，不能只是同一个行程改价格
  - 三个版本之间以及与主行程的活动重合度建议不超过 50%（允许保留1-2个核心推荐不变）
  - 经济版建议包含至少 1-2 个主行程中没有的活动（如免费公园替代收费景点、平价小吃替代正餐餐厅）
  - 品质版建议包含至少 2-3 个主行程中没有的活动（如高端餐厅、VIP体验、精品场所）
  - 如果候选POI有限，允许保留部分核心活动不变，但至少替换 1 个活动以体现差异
  - 同一版本中不建议出现同品牌的不同门店（如不能同时安排两个麦当劳、两个星巴克）
  - 同一版本的活动必须地理集中：优先选择同一商圈/区域内的场所，减少交通时间
  - 经济版的餐饮应选择不同类型（如一个快餐+一个小吃街，而非两个同类快餐）
  - 根据用户预算和城市物价水平动态定价，不要写死价格区间
  - 如果用户没有明确预算，根据城市物价和场景推算合理区间

同时输出一个 "uiStrategy" 字段，用于前端UI渲染策略：
- "variant": "romantic" 用于约会/纪念日方案，"family" 用于亲子/家庭方案，"business" 用于商务/工作行程，"compact" 用于简洁预览（首页卡片），"default" 用于其他
- "emphasis": 应该被视觉高亮的活动ID数组（最多2个，选择最有代表性的活动）
- "warnings": 数组，每个包含 {id, message, severity}，对行程中的潜在问题进行提示（如时间太紧、预算偏高、天气风险等），severity 为 "info" | "warning" | "danger"
- "suggestedActions": 数组，每个包含 {icon, label, prompt}，提供3-5个与当前行程上下文相关的 AI 建议操作

## UI Generation Guidelines
When generating the uiStrategy field, follow these rules from our UI Generation Skill:
- Choose variant based on trip context (romantic/family/business/default)
- Include at most 2 emphasis activities and 3 warnings
- Suggest 3-4 context-relevant copilot actions
- Use warning severities: info for suggestions, warning for concerns, danger for blockers

严格返回 JSON 格式，不要包含 markdown 代码块标记。strategy、conflictResolution、reasoning、teamFit 都是必填字段。`;

    let rawText: string;
    try {
      rawText = await callDashScope(systemPrompt, query, true, signal);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isAPIError =
        msg.includes('no_api_key') ||
        msg.includes('api') ||
        msg.includes('请求失败') ||
        msg.includes('longcat') ||
        msg.includes('dashscope') ||
        msg.includes('not_configured');
      if (isAPIError) {
        console.warn(
          '[AI] AI API 不可用，尝试使用真实 POI 组织方案:',
          err instanceof Error ? err.message : err
        );
        const poiPlan = dataSource.hasAmap ? await buildPlanFromPOI(query, userCity) : null;
        const fallbackPlan = poiPlan || generateMockPlan(query, userCity);
        if (!fallbackPlan.uiStrategy) {
          fallbackPlan.uiStrategy = generateFallbackUIStrategy(fallbackPlan);
        }
        return fallbackPlan;
      }
      throw err;
    }

    try {
      const plan = JSON.parse(rawText) as Plan;
      plan.id = `plan_${Date.now()}`;
      if (!plan.city) plan.city = userCity;
      if (!plan.uiStrategy) {
        plan.uiStrategy = generateFallbackUIStrategy(plan);
      }

      // ── POI 校验与坐标回填 ──
      // 将已知 POI 建立名称索引（模糊匹配）
      const poiNameMap = new Map<string, (typeof allKnownPOIs)[number]>();
      for (const poi of allKnownPOIs) {
        poiNameMap.set(poi.name.toLowerCase(), poi);
        // 也用去除括号后缀的名称做索引（如 "星巴克(三里屯店)" → "星巴克"）
        const baseName = poi.name
          .replace(/[（(].+?[）)]/g, '')
          .trim()
          .toLowerCase();
        if (baseName !== poi.name.toLowerCase() && !poiNameMap.has(baseName)) {
          poiNameMap.set(baseName, poi);
        }
      }

      function matchPOI(title: string): (typeof allKnownPOIs)[number] | undefined {
        const lower = title.toLowerCase();
        // 精确匹配
        if (poiNameMap.has(lower)) return poiNameMap.get(lower);
        // 去括号匹配
        const base = lower.replace(/[（(].+?[）)]/g, '').trim();
        if (poiNameMap.has(base)) return poiNameMap.get(base);
        // 包含匹配：已知 POI 名称包含在活动标题中，或反之
        for (const [name, poi] of poiNameMap) {
          if (name.length >= 2 && (lower.includes(name) || name.includes(lower))) {
            return poi;
          }
        }
        return undefined;
      }

      function validateActivities(activities: Activity[]): Activity[] {
        let matched = 0;
        let enriched = 0;
        const result = activities.map((a) => {
          if (a.type === 'travel') return a;
          const poi = matchPOI(a.title);
          if (poi) {
            matched++;
            const updates: Partial<Activity> = {};
            if (!a.poiId && poi.id) updates.poiId = poi.id;
            if (a.lat == null && poi.lat != null) {
              updates.lat = poi.lat;
              enriched++;
            }
            if (a.lng == null && poi.lng != null) updates.lng = poi.lng;
            if (!a.address && poi.address) updates.address = poi.address;
            if (!a.rating && poi.rating) updates.rating = parseFloat(poi.rating) || undefined;
            if (Object.keys(updates).length > 0) {
              return { ...a, ...updates };
            }
          }
          return a;
        });
        const unverified = result.filter(
          (a) => a.type !== 'travel' && a.lat == null && a.lng == null
        );
        console.log(
          `[POI校验] ${activities.filter((a) => a.type !== 'travel').length} 个活动, ` +
            `匹配已知POI: ${matched}, 回填坐标: ${enriched}, 缺坐标: ${unverified.length}`
        );
        if (unverified.length > 0) {
          console.warn(
            '[POI校验] 以下活动无法匹配已知POI且缺少坐标:',
            unverified.map((a) => a.title).join(', ')
          );
        }
        return result;
      }

      plan.activities = validateActivities(plan.activities);
      if (Array.isArray(plan.budgetOptions)) {
        plan.budgetOptions = plan.budgetOptions.map((opt) => ({
          ...opt,
          activities: opt.activities ? validateActivities(opt.activities) : opt.activities,
        }));
      }

      // 为活动添加经纬度（如果没有）
      const activitiesWithCoords = plan.activities.map((a, i) => ({
        ...a,
        imageUrl:
          getActivityImage(
            {
              id: a.id,
              title: a.title,
              description: a.description,
              type: a.type,
              tags: a.tags || [],
            },
            i
          ) ||
          fallbackImages[a.id] ||
          fallbackImages[String(i + 1)] ||
          fallbackImages['1'],
        // 保持 AI 返回的经纬度，不生成随机坐标
        ...(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : {}),
      }));

      // 应用路线优化和时间分配
      const optimizationResult = optimizeActivitiesWithConstraints(activitiesWithCoords as any, {
        strategy: 'balanced',
        applyTimeConstraints: true,
        applyTypeConstraints: true,
      });

      // 使用动态时间分配替代硬编码
      const optimizedActivities = optimizationResult.optimizedActivities as unknown as Activity[];
      const hasCoords = optimizedActivities.some((a) => a.lat != null && a.lng != null);

      if (hasCoords) {
        try {
          const timeResult = await allocateTimeWithRealMap(optimizedActivities, {
            city: userCity,
            startHour: 9,
            travelMode: 'driving',
          });
          plan.activities = timeResult.activities;
        } catch (err) {
          console.warn('[generatePlanLocally] 时间分配失败，使用默认值:', err);
          plan.activities = optimizedActivities;
        }
      } else {
        plan.activities = optimizedActivities;
      }

      // 对 budgetOptions 也做路线优化和类型约束修复
      if (Array.isArray(plan.budgetOptions)) {
        for (const option of plan.budgetOptions) {
          if (Array.isArray(option.activities) && option.activities.length > 1) {
            try {
              const withCoords = option.activities.map((a, i) => ({
                ...a,
                ...(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : {}),
              }));
              const hasCoord = withCoords.some((a: any) => a.lat != null && a.lng != null);
              if (hasCoord) {
                const optResult = optimizeActivitiesWithConstraints(withCoords as any, {
                  strategy: 'distance',
                  applyTimeConstraints: true,
                  applyTypeConstraints: true,
                });
                option.activities = optResult.optimizedActivities as any;
              }
            } catch (err) {
              console.warn('[generatePlanLocally] budgetOptions 路线优化失败:', err);
            }
          }
        }
      }

      const explicitLodgingKeywords = parseLodgingKeywords(query);
      const lodgingDecision = decideLodgingNeed(
        plan.activities,
        undefined,
        undefined,
        explicitLodgingKeywords
      );
      plan.lodging = {
        needLodging: lodgingDecision.needLodging,
        decisionReason: lodgingDecision.reason,
        confidence: lodgingDecision.confidence,
        checkIn: lodgingDecision.checkInTime,
        checkOut: lodgingDecision.checkOutTime,
      };

      if (lodgingDecision.needLodging && lodgingDecision.checkInTime) {
        try {
          const hotelPois = await cachedSearchPOI('酒店', userCity, 5000);
          if (hotelPois.length > 0) {
            const selectedHotel = hotelPois[0];
            const hotelPrice =
              typeof selectedHotel.cost === 'string'
                ? parseInt(selectedHotel.cost) || 300
                : selectedHotel.cost || 300;
            const hotelRating =
              typeof selectedHotel.rating === 'string'
                ? parseFloat(selectedHotel.rating) || 4.5
                : selectedHotel.rating || 4.5;

            plan.lodging.hotel = {
              id: `hotel_${Date.now()}`,
              name: selectedHotel.name,
              address: selectedHotel.address,
              price: hotelPrice,
              rating: hotelRating,
              timeLine: `${lodgingDecision.checkInTime} - ${lodgingDecision.checkOutTime}`,
            };

            plan.activities.push({
              id: String(plan.activities.length + 1),
              title: selectedHotel.name,
              type: 'lodging',
              timeLine: `${lodgingDecision.checkInTime} - ${lodgingDecision.checkOutTime}`,
              price: hotelPrice,
              description: `入住${selectedHotel.name}，结束完美的一天`,
              tags: ['住宿', '酒店'],
              reasoning: '跨天出行，安排住宿休息',
              teamFit: '适合所有人',
            });

            plan.lodging.alternatives = hotelPois.slice(1, 4).map((p, idx) => ({
              id: `hotel_alt_${idx}`,
              name: p.name,
              price: typeof p.cost === 'string' ? parseInt(p.cost) || 300 : p.cost || 300,
              rating: typeof p.rating === 'string' ? parseFloat(p.rating) || 4.5 : p.rating || 4.5,
              address: p.address,
            }));

            plan.totalPrice += hotelPrice;
          }
        } catch (err) {
          console.warn('[generatePlanLocally] 酒店搜索失败:', err);
        }
      }

      // 阶段 3：约束求解（优化活动顺序和时间分配）
      const { optimizedPlan, changes: solverChanges } = solveConstraints(plan, constraints);
      if (solverChanges.length > 0) {
        console.log('[generatePlanLocally] 约束求解调整:', solverChanges.join('；'));
        Object.assign(plan, optimizedPlan);
      }

      // 检查预算版本与主行程的重合度，并自动替换重合活动
      if (Array.isArray(plan.budgetOptions)) {
        const mainActivityTitles = new Set(plan.activities.map((a) => a.title));
        // 已知 POI 中未被主行程使用的，作为替换候选
        const unusedPOIs = allKnownPOIs.filter((poi) => !mainActivityTitles.has(poi.name));

        for (const option of plan.budgetOptions) {
          if (!Array.isArray(option.activities)) continue;

          const overlapIndices: number[] = [];
          option.activities.forEach((a, i) => {
            if (mainActivityTitles.has(a.title)) overlapIndices.push(i);
          });
          const totalCount = option.activities.length;
          const overlapPercent = totalCount > 0 ? overlapIndices.length / totalCount : 0;

          // 重合度 > 50% 时自动替换
          if (overlapPercent > 0.5 && unusedPOIs.length > 0) {
            const usedInOption = new Set(option.activities.map((a) => a.title));
            let replaced = 0;

            for (const idx of overlapIndices) {
              if (replaced >= Math.ceil(overlapIndices.length / 2)) break;
              const original = option.activities[idx];
              // 找同类型的替换候选
              const typeHint = original.type === 'food' ? '餐饮' : '景点';
              const candidate = unusedPOIs.find(
                (poi) =>
                  !usedInOption.has(poi.name) &&
                  (poi.type.includes(typeHint) || poi.type.includes(original.type))
              );
              if (candidate) {
                option.activities[idx] = {
                  ...original,
                  title: candidate.name,
                  description: `${option.label}推荐：${candidate.name}`,
                  price: candidate.cost
                    ? parseInt(String(candidate.cost)) || original.price
                    : original.price,
                  address: candidate.address || original.address,
                  rating: candidate.rating
                    ? parseFloat(candidate.rating) || original.rating
                    : original.rating,
                  lat: candidate.lat ?? original.lat,
                  lng: candidate.lng ?? original.lng,
                };
                usedInOption.add(candidate.name);
                replaced++;
              }
            }
            if (replaced > 0) {
              console.log(
                `[generatePlanLocally] ${option.label} 自动替换了 ${replaced} 个重合活动`
              );
            }
          }

          // 仍打印警告（供日志追踪）
          const newOverlap = option.activities.filter((a) =>
            mainActivityTitles.has(a.title)
          ).length;
          const newPercent = totalCount > 0 ? newOverlap / totalCount : 0;
          if (newPercent > 0.5) {
            console.warn(
              `[generatePlanLocally] ${option.label} 与主行程重合度仍较高: ${(newPercent * 100).toFixed(0)}%`
            );
          }
        }
      }

      // 阶段 4：自检（纯规则，不依赖 LLM）
      const validationResult = validatePlan(plan, constraints, { autoFix: true });
      if (!validationResult.valid) {
        console.log('[generatePlanLocally] 自检发现问题:', validationResult.summary);
        for (const issue of validationResult.issues.filter(
          (i) => i.severity === 'error' || i.severity === 'warning'
        )) {
          console.log(`  - [${issue.severity}] ${issue.message}`);
        }
        // 如果有自动修正，使用修正后的行程
        if (validationResult.fixedPlan) {
          console.log('[generatePlanLocally] 应用自动修正');
          return validationResult.fixedPlan;
        }
      } else {
        console.log('[generatePlanLocally] 自检通过，评分:', validationResult.score);
      }

      return await enrichPlanImages(plan, userCity);
    } catch (error) {
      console.error('Failed to parse AI response:', rawText, error);
      const poiPlan = dataSource.hasAmap ? await buildPlanFromPOI(query, userCity) : null;
      if (poiPlan) {
        if (!poiPlan.uiStrategy) {
          poiPlan.uiStrategy = generateFallbackUIStrategy(poiPlan);
        }
        return poiPlan;
      }
      const mockPlan = generateMockPlan(query, userCity);
      if (!mockPlan.uiStrategy) {
        mockPlan.uiStrategy = generateFallbackUIStrategy(mockPlan);
      }
      return mockPlan;
    }
  } catch (err) {
    console.error('[generatePlanLocally] Fatal error, falling back to mock:', err);
    const userCity = cityParam || '北京';
    const mockPlan = generateMockPlan(query, userCity);
    if (!mockPlan.uiStrategy) {
      mockPlan.uiStrategy = generateFallbackUIStrategy(mockPlan);
    }
    return mockPlan;
  }
}

export async function generatePlan(
  query: string,
  cityParam?: string,
  signal?: AbortSignal,
  travelDNA?: TravelDNA,
  context?: PlanningContext,
  sessionId?: string | null
): Promise<Plan> {
  if (signal?.aborted) {
    throw new Error('AbortError');
  }

  if (isBrowserRuntime()) {
    try {
      console.log('[generatePlan] 浏览器端：调用服务端 API');
      const response = await generatePlanViaServer({
        query,
        city: cityParam,
        signal,
        travelDNA: travelDNA as unknown as Record<string, unknown>,
        context: context as unknown as Record<string, unknown> | undefined,
        sessionId: sessionId || undefined,
      });
      console.log(
        '[generatePlan] 服务端返回成功，plan title:',
        response.plan?.title,
        'activities:',
        response.plan?.activities?.length
      );
      return response.plan;
    } catch (error) {
      const isAborted =
        error instanceof DOMException
          ? error.name === 'AbortError'
          : error instanceof Error &&
            (error.message === 'AbortError' || error.name === 'AbortError');
      if (isAborted || signal?.aborted) {
        throw new Error('AbortError');
      }
      console.warn(
        '[generatePlan] 服务端调用失败，降级到本地生成:',
        error instanceof Error ? error.message : error
      );
    }
  }

  if (signal?.aborted) {
    throw new Error('AbortError');
  }

  console.log('[generatePlan] 本地端：直接调用 generatePlanLocally');
  return generatePlanLocally(query, cityParam, signal, travelDNA, context);
}

// [PERF-OPT] SSE streaming version for reduced perceived latency
export async function generatePlanStreaming(
  query: string,
  cityParam: string | undefined,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  travelDNA?: TravelDNA,
  context?: PlanningContext,
  sessionId?: string | null
): Promise<Plan> {
  if (signal?.aborted) {
    throw new Error('AbortError');
  }

  // Try server-side streaming first (browser runtime)
  if (isBrowserRuntime()) {
    try {
      const response = await generatePlanStream(query, cityParam, onChunk, signal, sessionId);
      return response.plan;
    } catch (error) {
      const isAborted =
        error instanceof DOMException
          ? error.name === 'AbortError'
          : error instanceof Error &&
            (error.message === 'AbortError' || error.name === 'AbortError');
      if (isAborted || signal?.aborted) {
        throw new Error('AbortError');
      }
      console.warn('[serverFallback] streaming plan generation failed, fallback to local', error);
    }
  }

  if (signal?.aborted) {
    throw new Error('AbortError');
  }

  // [PERF-OPT] Server-side: use real DashScope streaming
  query = sanitizeUserInput(query);
  const userCity = cityParam || (await getUserCity());

  let poiContext = '';
  if (dataSource.hasAmap) {
    try {
      const keywords = inferSearchKeywords(query);
      const [foodPois, activityPois] = await Promise.all([
        cachedSearchPOI(keywords.food, userCity, 5000),
        cachedSearchPOI(keywords.activity, userCity, 5000),
      ]);

      if (foodPois.length > 0 || activityPois.length > 0) {
        console.log(
          '[generatePlanStreaming] POI搜索: 餐饮=' +
            foodPois.length +
            ' 活动=' +
            activityPois.length
        );

        const foodList = foodPois
          .slice(0, 5)
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} - ${p.type} - ${p.address || '地址未知'} - 评分${p.rating || '?'}`
          )
          .join('\n');
        const activityList = activityPois
          .slice(0, 5)
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} - ${p.type} - ${p.address || '地址未知'} - 评分${p.rating || '?'}`
          )
          .join('\n');
        poiContext = `\n【真实POI数据】这些是${userCity}的真实商家/景点，你必须从中选择：\n餐饮推荐：\n${foodList || '暂无数据'}\n\n活动景点：\n${activityList || '暂无数据'}\n\n重要：你必须从上面的真实POI中选择地点名称，不得虚构地点！`;
      }
    } catch (error) {
      console.error('[generatePlanStreaming] POI搜索失败:', error);
    }
  }

  const dnaContext =
    travelDNA && travelDNA.meta.confidence > 0.2 ? `\n${dnaToPromptContext(travelDNA)}\n` : '';

  const prefsContext = await buildPrefsContext();

  const weatherContext = context?.weather
    ? `\n【实时天气】${context.weather.city} ${context.weather.temp}°C ${context.weather.condition}。${context.weather.advice}\n`
    : '';

  let collabContext = '';
  if (context?.collaboration) {
    const c = context.collaboration;
    const parts: string[] = [`协调策略：${c.strategyLabel}`];
    if (c.consensus.length) parts.push(`共识：${c.consensus.join('、')}`);
    if (c.conflicts.length) parts.push(`分歧：${c.conflicts.join('、')}`);
    if (c.topAvoids?.length) parts.push(`共同避雷：${c.topAvoids.join('、')}`);
    if (c.tieBreakerLabel) parts.push(`裁决方式：${c.tieBreakerLabel}`);
    collabContext = `\n【多人协作】${parts.join('。')}\n`;
  }

  const memberInfo =
    context?.memberCount && context.memberCount > 1
      ? `本次出行共 ${context.memberCount} 人，请注意活动安排要适合所有人。`
      : '';

  const constraintsContext = context?.profiles?.length
    ? constraintsToPromptContext(
        extractConstraints(query, context.profiles as PersonProfile[], context.timePref)
      )
    : '';

  const systemPrompt = `你是一个专业的美团本地生活规划师，同时也是多人关系协调专家。用户当前所在城市：${userCity}。用户想要一个周末/下午的短途出行计划。
${dnaContext}${prefsContext}${weatherContext}${collabContext}
${constraintsContext}
${memberInfo}
根据用户需求生成完整、可执行的方案。所有推荐的地点必须在${userCity}市或其周边区域。
${poiContext}

⚠️ 重要：这是一个单日出行计划，所有活动必须在同一天内完成，不要生成多天行程。除非用户明确说"两天"、"三天"、"多日"，否则所有活动的时间线都安排在同一天。

⚠️ 目标推理（Goal Reasoning）— 在生成行程前，你必须先理解用户的真实目标：
1. **表层目标**：用户直接说的（如"出去玩"）
2. **深层目标**：用户真正想要的（如"家庭陪伴"、"增进感情"、"放松减压"）
3. **情感需求**：用户未说出口的（如"让父母开心"、"创造浪漫回忆"、"展示品味"）
4. **推荐策略**：基于目标推导的选点原则（如"优先安静有座位"、"安排拍照点"、"避免尴尬"）
请结合用户输入、同行人画像、用户偏好、对话语境，综合推理真实目标。不要只看表面关键词。

活动数量策略（根据用户需求动态调整）：
- "深度体验"/"满满一天"/"全天" → 4-5 个活动
- "随便逛逛"/"简单"/"透透气" → 2 个活动
- 默认 → 3 个活动（2个餐饮+1个景点交替）

餐饮分配规则（强制执行）：
- 每天最多安排 1 次咖啡/下午茶/奶茶/饮品类活动
- 2个餐饮时：必须至少1个是正餐（午餐或晚餐），另1个可以是正餐或咖啡/下午茶
- 3个餐饮时：至少2个正餐，最多1个咖啡/下午茶
- 正餐指有主食的餐饮（如火锅、烧烤、面馆、餐厅等），咖啡/甜品/奶茶不算正餐

如果用户提供了【同行人】信息和【决策策略】，你必须：
1. 深度分析每个人的偏好、年龄、忌口、体力限制
2. 根据【决策策略】平衡各方需求
3. 为每个活动说明"为什么选这里"（关联到具体人的需求和深层目标）
4. 如有偏好冲突，在 conflictResolution 中说明如何调和

tieBreaker（冲突裁决）强制执行规则：
- "照顾老人优先" → 排除需要大量步行、爬楼梯、长时间站立的场所，优先安静、有座位的
- "儿童优先" → 排除酒吧、夜店等成人场所，优先有互动区、游乐设施的
- "民主共识" → 每个活动至少被2人偏好，否则换替代
- "效率优先" → 间距不超过5km，减少交通时间

时间策略强制执行规则（根据同行人特征自动适配）：
- 有儿童（≤6岁）：每个活动不超过 2 小时，活动之间必须有 15-20 分钟休息间隔，避免需要大量步行/爬山的场所，优先室内游乐、亲子互动
- 有老人/体力受限者：活动时长不超过 1.5 小时，必须有座位休息点，避免连续站立超过 30 分钟
- 有减肥/低卡需求者：餐厅优先安排轻食/沙拉/低卡选项，避免在高强度活动后安排大餐，可安排下午茶代替正餐
- 总时长 4-6 小时：安排 3-4 个活动（含餐饮），每个活动 1-2 小时，预留交通和缓冲时间
- 活动顺序建议：轻体力（咖啡/展览）→ 中体力（亲子乐园/购物）→ 餐饮 → 轻体力（散步/公园）

如果只有一个人出行，也要在 strategy 中简要说明规划思路（如"根据个人偏好精选"），conflictResolution 写"个人出行"。

必须包含：
- 标题：描述性标题
- durationTags：时长描述如"约5.5小时"
- tags：2-3个标签如"家庭亲子", "轻松减压"
- summary：一句话总结
- city：用户所在城市"${userCity}"（除非用户明确指定了其他城市）
- strategy：必填，使用的决策策略说明
- conflictResolution：必填，冲突调和说明
- activities：活动数组，每个活动包含 id, timeLine, title, type, description, price, distanceInfo, tags, reasoning, teamFit
- totalPrice：总价格
- budgetOptions：预算版本数组，包含 3 个版本，每个版本必须有不同的活动方案：
  - 经济版：选择免费/低价场所（公园、免费展览、平价小吃街），人均约节省 30-40%
  - 标准版：平衡体验和价格（中档餐厅、常规景点），匹配用户预算
  - 品质版：选择高端场所（精品餐厅、VIP体验、特色高端活动），人均约增加 50-80%
  - 每个版本包含 {label, perPerson, total, strategy, activities}
  - activities 中每个活动包含 {title, type, timeLine, price, description}
  - 三个版本的活动必须不同（不同地点、不同餐厅、不同体验），不能只是价格不同
- uiStrategy: { variant, emphasis, warnings, suggestedActions }

严格返回 JSON 格式，不要包含 markdown 代码块标记。strategy、conflictResolution、reasoning、teamFit 都是必填字段。`;

  let rawText: string;
  try {
    onChunk('[思考中...]');
    rawText = await callDashScopeStreaming(systemPrompt, query, onChunk, true, signal);
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const isAPIError =
      msg.includes('no_api_key') ||
      msg.includes('api') ||
      msg.includes('请求失败') ||
      msg.includes('longcat') ||
      msg.includes('dashscope') ||
      msg.includes('not_configured');
    if (isAPIError) {
      console.warn(
        '[AI-Stream] AI API 不可用，尝试使用真实 POI 组织方案:',
        err instanceof Error ? err.message : err
      );
      const poiPlan = dataSource.hasAmap ? await buildPlanFromPOI(query, userCity) : null;
      const fallbackPlan = poiPlan || generateMockPlan(query, userCity);
      if (!fallbackPlan.uiStrategy) {
        fallbackPlan.uiStrategy = generateFallbackUIStrategy(fallbackPlan);
      }
      return fallbackPlan;
    }
    throw err;
  }

  try {
    const plan = JSON.parse(rawText) as Plan;
    plan.id = `plan_${Date.now()}`;
    if (!plan.city) plan.city = userCity;
    if (!plan.uiStrategy) {
      plan.uiStrategy = generateFallbackUIStrategy(plan);
    }

    const activitiesWithCoords = plan.activities.map((a, i) => ({
      ...a,
      imageUrl:
        getActivityImage(
          {
            id: a.id,
            title: a.title,
            description: a.description,
            type: a.type,
            tags: a.tags || [],
          },
          i
        ) ||
        fallbackImages[a.id] ||
        fallbackImages[String(i + 1)] ||
        fallbackImages['1'],
      ...(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : {}),
    }));

    const optimizationResult = optimizeActivitiesWithConstraints(activitiesWithCoords as any, {
      strategy: 'balanced',
      applyTimeConstraints: true,
      applyTypeConstraints: true,
    });

    const optimizedActivities = optimizationResult.optimizedActivities as unknown as Activity[];
    const hasCoords = optimizedActivities.some((a) => a.lat != null && a.lng != null);

    if (hasCoords) {
      try {
        const timeResult = await allocateTimeWithRealMap(optimizedActivities, {
          city: userCity,
          startHour: 9,
          travelMode: 'driving',
        });
        plan.activities = timeResult.activities;
      } catch (err) {
        console.warn('[generatePlanStreaming] 时间分配失败，使用默认值:', err);
        plan.activities = optimizedActivities;
      }
    } else {
      plan.activities = optimizedActivities;
    }

    const explicitLodgingKeywords = parseLodgingKeywords(query);
    const lodgingDecision = decideLodgingNeed(
      plan.activities,
      undefined,
      undefined,
      explicitLodgingKeywords
    );
    plan.lodging = {
      needLodging: lodgingDecision.needLodging,
      decisionReason: lodgingDecision.reason,
      confidence: lodgingDecision.confidence,
      checkIn: lodgingDecision.checkInTime,
      checkOut: lodgingDecision.checkOutTime,
    };

    if (lodgingDecision.needLodging && lodgingDecision.checkInTime) {
      try {
        const hotelPois = await cachedSearchPOI('酒店', userCity, 5000);
        if (hotelPois.length > 0) {
          const selectedHotel = hotelPois[0];
          const hotelPrice =
            typeof selectedHotel.cost === 'string'
              ? parseInt(selectedHotel.cost) || 300
              : selectedHotel.cost || 300;
          const hotelRating =
            typeof selectedHotel.rating === 'string'
              ? parseFloat(selectedHotel.rating) || 4.5
              : selectedHotel.rating || 4.5;

          plan.lodging.hotel = {
            id: `hotel_${Date.now()}`,
            name: selectedHotel.name,
            address: selectedHotel.address,
            price: hotelPrice,
            rating: hotelRating,
            timeLine: `${lodgingDecision.checkInTime} - ${lodgingDecision.checkOutTime}`,
          };

          plan.activities.push({
            id: String(plan.activities.length + 1),
            title: selectedHotel.name,
            type: 'lodging',
            timeLine: `${lodgingDecision.checkInTime} - ${lodgingDecision.checkOutTime}`,
            price: hotelPrice,
            description: `入住${selectedHotel.name}，结束完美的一天`,
            tags: ['住宿', '酒店'],
            reasoning: '跨天出行，安排住宿休息',
            teamFit: '适合所有人',
          });

          plan.lodging.alternatives = hotelPois.slice(1, 4).map((p, idx) => ({
            id: `hotel_alt_${idx}`,
            name: p.name,
            price: typeof p.cost === 'string' ? parseInt(p.cost) || 300 : p.cost || 300,
            rating: typeof p.rating === 'string' ? parseFloat(p.rating) || 4.5 : p.rating || 4.5,
            address: p.address,
          }));

          plan.totalPrice += hotelPrice;
        }
      } catch (err) {
        console.warn('[generatePlanStreaming] 酒店搜索失败:', err);
      }
    }

    return await enrichPlanImages(plan, userCity);
  } catch (error) {
    console.error('[generatePlanStreaming] Failed to parse AI response:', rawText, error);
    const poiPlan = dataSource.hasAmap ? await buildPlanFromPOI(query, userCity) : null;
    if (poiPlan) {
      if (!poiPlan.uiStrategy) {
        poiPlan.uiStrategy = generateFallbackUIStrategy(poiPlan);
      }
      return poiPlan;
    }
    const mockPlan = generateMockPlan(query, userCity);
    if (!mockPlan.uiStrategy) {
      mockPlan.uiStrategy = generateFallbackUIStrategy(mockPlan);
    }
    return mockPlan;
  }
}
