/**
 * CandidateSearch - 并行候选搜索
 *
 * 阶段 2：根据约束条件，并行搜索多个类别的候选地点，
 * 为 LLM 提供更丰富的上下文。
 *
 * 搜索策略：
 * - 根据约束的 preferredTypes 推导搜索关键词
 * - 根据约束的 avoidedCategories 排除不适合的地点
 * - 个性化排序后注入 prompt
 */

import { cachedSearchPOI } from './cache';
import { dataSource } from '../apiAdapter';
import {
  rankPOIs,
  applyDiversityControl,
  rankedPOIsToPromptContext,
  type RankedPOI,
} from './poiRanking';
import type { TravelConstraints } from './constraintExtractor';
import type { UnifiedUserProfile } from './unifiedProfile';

// ── 候选搜索结果 ──

export interface CandidateSearchResult {
  foodCandidates: RankedPOI[];
  activityCandidates: RankedPOI[];
  weatherCandidates: string[]; // 天气相关的建议
  promptContext: string; // 组装好的 prompt 上下文
  searchSummary: string; // 搜索摘要
}

// ── 搜索关键词推导 ──

function deriveSearchKeywords(constraints: TravelConstraints): {
  foodKeywords: string[];
  activityKeywords: string[];
} {
  const foodKeywords: string[] = [];
  const activityKeywords: string[] = [];

  // 餐饮关键词
  if (constraints.dining.mealType === 'light') {
    foodKeywords.push('轻食', '沙拉', '低卡');
  }
  if (constraints.dining.preferredCategories.length > 0) {
    foodKeywords.push(...constraints.dining.preferredCategories);
  }
  if (constraints.dining.dietaryRestrictions.includes('素食')) {
    foodKeywords.push('素食');
  }
  if (constraints.travel.hasChildren) {
    foodKeywords.push('亲子餐厅');
  }
  // 默认补充
  if (foodKeywords.length === 0) {
    foodKeywords.push('美食', '餐厅');
  }

  // 活动关键词
  if (constraints.activity.preferredTypes.length > 0) {
    activityKeywords.push(...constraints.activity.preferredTypes);
  }
  if (constraints.travel.hasChildren) {
    activityKeywords.push('亲子乐园', '儿童游乐');
  }
  if (constraints.intent === 'date') {
    activityKeywords.push('咖啡馆', '展览');
  }
  if (constraints.intent === 'friends_gathering') {
    activityKeywords.push('桌游', '密室', 'KTV');
  }
  // 默认补充
  if (activityKeywords.length === 0) {
    activityKeywords.push('景点', '活动');
  }

  return { foodKeywords, activityKeywords };
}

// ── 过滤不适合的地点 ──

function filterUnsuitable(pois: RankedPOI[], constraints: TravelConstraints): RankedPOI[] {
  return pois.filter((poi) => {
    const text = `${poi.name} ${poi.type}`.toLowerCase();

    // 检查回避类别
    for (const avoid of constraints.dining.avoidedCategories) {
      if (text.includes(avoid.toLowerCase())) return false;
    }
    for (const avoid of constraints.activity.avoidedTypes) {
      if (text.includes(avoid.toLowerCase())) return false;
    }

    // 检查不适合儿童的场所
    if (constraints.travel.hasChildren) {
      if (/酒吧|夜店|ktv|网吧|密室逃脱|鬼屋/.test(text)) return false;
    }

    // 检查不适合老人的场所
    if (constraints.travel.hasElderly) {
      if (/爬山|徒步|攀岩|滑雪|过山车|跳楼机/.test(text)) return false;
    }

    return true;
  });
}

// ── 主函数 ──

/**
 * 并行搜索候选地点
 */
export async function searchCandidates(
  constraints: TravelConstraints,
  city: string,
  userProfile?: UnifiedUserProfile
): Promise<CandidateSearchResult> {
  if (!dataSource.hasAmap) {
    return {
      foodCandidates: [],
      activityCandidates: [],
      weatherCandidates: [],
      promptContext: '',
      searchSummary: '无地图数据，使用 AI 推荐',
    };
  }

  const { foodKeywords, activityKeywords } = deriveSearchKeywords(constraints);

  // 并行搜索
  const [foodPois, activityPois] = await Promise.all([
    // 餐厅搜索：多个关键词并行
    Promise.all(
      foodKeywords
        .slice(0, 3)
        .map((kw) => cachedSearchPOI(kw, city, 5000, '050000').catch(() => []))
    ).then((results) => results.flat()),
    // 活动搜索：多个关键词并行
    Promise.all(
      activityKeywords.slice(0, 3).map((kw) => cachedSearchPOI(kw, city, 5000).catch(() => []))
    ).then((results) => results.flat()),
  ]);

  // 去重
  const uniqueFood = deduplicatePOIs(foodPois);
  const uniqueActivity = deduplicatePOIs(activityPois);

  // 城市后验过滤：确保 POI 属于目标城市
  const cityFilteredFood = uniqueFood.filter((poi) => {
    if (!poi.address) return true;
    const addr = poi.address.toLowerCase();
    const cityName = city.toLowerCase();
    return addr.includes(cityName) || addr.includes(cityName.replace('市', ''));
  });

  const cityFilteredActivity = uniqueActivity.filter((poi) => {
    if (!poi.address) return true;
    const addr = poi.address.toLowerCase();
    const cityName = city.toLowerCase();
    return addr.includes(cityName) || addr.includes(cityName.replace('市', ''));
  });

  // 个性化排序
  const profile = userProfile || {
    activityPreferences: {
      food: 0.4,
      activity: 0.3,
      transit: 0.3,
      topCategories: [],
      avoidedCategories: [],
    },
    budgetProfile: {
      avgPerPerson: 150,
      range: [50, 300],
      sensitivity: 'medium' as const,
      preferredRange: '¥100-200',
    },
    timePreferences: { preferredStart: '下午', avgDuration: 4, weekendVsWeekday: 0.8 },
    travelPatterns: {
      frequency: 'rare' as const,
      groupSize: 1,
      soloVsGroup: 0.5,
      lastTripDaysAgo: 999,
    },
    styleTags: [],
    favoriteCategories: constraints.dining.preferredCategories,
    avoidCategories: constraints.dining.avoidedCategories,
    dietaryRestrictions: constraints.dining.dietaryRestrictions,
    locationPreferences: { topCities: [], topAreas: [], preferredDistance: 2000 },
    brandPreferences: { favoriteBrands: [], avoidedBrands: [] },
    decisionStyle: { avgDecisionTime: 0, selectRate: 0, completionRate: 0 },
    behaviorInsights: [],
    meta: { confidence: 0, dataPoints: 0, lastUpdated: Date.now() },
  };

  let rankedFood = rankPOIs(cityFilteredFood, profile, { city });
  let rankedActivity = rankPOIs(cityFilteredActivity, profile, { city });

  // 过滤不适合的地点
  rankedFood = filterUnsuitable(rankedFood, constraints);
  rankedActivity = filterUnsuitable(rankedActivity, constraints);

  // 多样性控制
  rankedFood = applyDiversityControl(rankedFood, 8);
  rankedActivity = applyDiversityControl(rankedActivity, 8);

  // 构建 prompt 上下文
  const foodContext = rankedPOIsToPromptContext(rankedFood, city, 6);
  const activityContext = rankedPOIsToPromptContext(rankedActivity, city, 6);

  const promptContext = [foodContext, activityContext].filter(Boolean).join('\n\n');

  // 搜索摘要
  const summaryParts: string[] = [];
  if (rankedFood.length > 0) summaryParts.push(`${rankedFood.length} 个餐厅候选`);
  if (rankedActivity.length > 0) summaryParts.push(`${rankedActivity.length} 个活动候选`);

  return {
    foodCandidates: rankedFood,
    activityCandidates: rankedActivity,
    weatherCandidates: [],
    promptContext,
    searchSummary: summaryParts.join('，') || '未找到候选地点',
  };
}

// ── 工具函数 ──

function extractBrand(name: string): string {
  const match = name.match(/^([^(（]+)/);
  return match ? match[1].trim() : name;
}

function deduplicatePOIs(
  pois: Array<{
    name: string;
    type: string;
    address?: string;
    distance?: string;
    rating?: string;
    cost?: string;
  }>
) {
  const seen = new Set<string>();
  const brandSeen = new Set<string>();
  return pois.filter((poi) => {
    if (seen.has(poi.name)) return false;
    seen.add(poi.name);

    const brand = extractBrand(poi.name);
    if (brand.length >= 2 && brandSeen.has(brand)) return false;
    brandSeen.add(brand);

    return true;
  });
}
