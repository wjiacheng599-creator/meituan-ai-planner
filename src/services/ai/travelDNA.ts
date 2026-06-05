/**
 * Travel DNA - 深度用户画像系统
 *
 * 从历史行程、行为模式中提取用户偏好，用于个性化推荐。
 *
 * 数据来源：
 * 1. 已完成的行程（completedActivityIds）
 * 2. 已预订的活动（bookedActivityIds）
 * 3. 跳过的活动（在行程中但未预订/完成）
 * 4. 用户画像（PersonProfile）
 * 5. 协作历史（投票、避雷选择）
 *
 * 分析维度：
 * - 活动类型偏好（food / activity / travel 比例）
 * - 预算区间（人均消费范围）
 * - 出行频率（多久出一次门）
 * - 时间偏好（上午/下午/晚上）
 * - 人群偏好（独处/情侣/家庭/朋友）
 * - 风格偏好（轻松/高效/文艺/美食）
 */
import type { Plan, Activity } from './types';
import type { PersonProfile, PlannerTaskState, TaskSession } from '../../types';

// ── 类型定义 ──

export interface TravelDNA {
  // 活动偏好
  activityPreferences: {
    food: number; // 0-1，餐饮偏好强度
    activity: number; // 0-1，活动偏好强度
    transit: number; // 0-1，交通敏感度
    topCategories: string[]; // 最常去的类别
    avoidedCategories: string[]; // 常跳过的类别
  };

  // 预算画像
  budgetProfile: {
    avgPerPerson: number; // 人均消费
    range: [number, number]; // 消费区间 [min, max]
    sensitivity: 'low' | 'medium' | 'high'; // 价格敏感度
    preferredRange: string; // "¥50-100" 等文字描述
  };

  // 时间偏好
  timePreferences: {
    preferredStart: string; // "上午" / "下午" / "晚上"
    avgDuration: number; // 平均出行时长（小时）
    weekendVsWeekday: number; // 0=工作日偏好, 1=周末偏好
  };

  // 出行模式
  travelPatterns: {
    frequency: 'rare' | 'monthly' | 'weekly'; // 出行频率
    groupSize: number; // 平均出行人数
    soloVsGroup: number; // 0=独处, 1=群体
    lastTripDaysAgo: number; // 距上次出行天数
  };

  // 风格标签
  styleTags: string[]; // ["美食达人", "文艺青年", "效率派"] 等

  // 协作偏好（多人场景）
  collabPreferences?: {
    tieBreaker: string; // 常用的冲突裁决
    topVotes: string[]; // 最常投的票
    topAvoids: string[]; // 最常避雷的
  };

  // 元数据
  meta: {
    analyzedTrips: number; // 分析的行程数
    totalActivities: number; // 总活动数
    completionRate: number; // 完成率
    confidence: number; // 0-1，画像置信度
    lastUpdated: number; // 最后更新时间
  };
}

// ── 分析函数 ──

function analyzeActivityPreferences(
  plans: Plan[],
  taskStates: PlannerTaskState[]
): TravelDNA['activityPreferences'] {
  let foodCount = 0;
  let activityCount = 0;
  let transitCount = 0;
  const categoryMap = new Map<string, number>();
  const completedSet = new Set<string>();

  const safePlans = Array.isArray(plans) ? plans : [];
  const safeTaskStates = Array.isArray(taskStates) ? taskStates : [];

  // 收集所有已完成的活动 ID
  for (const ts of safeTaskStates) {
    for (const id of ts.completedActivityIds || []) {
      completedSet.add(`${ts.planId}_${id}`);
    }
    for (const id of ts.bookedActivityIds || []) {
      completedSet.add(`${ts.planId}_${id}`);
    }
  }

  for (const plan of safePlans) {
    for (const act of plan.activities) {
      const key = `${plan.id}_${act.id}`;
      const hasCompletionData = completedSet.size > 0;
      const isCompleted = hasCompletionData && completedSet.has(key);

      // 只有明确完成/预订的活动给予高权重；无完成记录时使用低权重（避免把所有生成行程当偏好）
      const weight = isCompleted ? 1 : hasCompletionData ? 0.2 : 0.1;
      if (act.type === 'food') foodCount += weight;
      else if (act.type === 'activity') activityCount += weight;
      else transitCount += weight;

      // 统计类别
      if (act.tags) {
        for (const tag of act.tags) {
          categoryMap.set(tag, (categoryMap.get(tag) || 0) + weight);
        }
      }
    }
  }

  const total = Math.max(foodCount + activityCount + transitCount, 1);

  // 排序取 top/avoided
  const sortedCategories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCategories.slice(0, 5).map(([tag]) => tag);
  const avoidedCategories = sortedCategories
    .slice(-3)
    .filter(([, v]) => v < 1)
    .map(([tag]) => tag);

  return {
    food: foodCount / total,
    activity: activityCount / total,
    transit: transitCount / total,
    topCategories,
    avoidedCategories,
  };
}

function analyzeBudgetProfile(
  plans: Plan[],
  profiles: PersonProfile[]
): TravelDNA['budgetProfile'] {
  const safePlans = Array.isArray(plans) ? plans : [];
  const prices = safePlans.map((p) => p.totalPrice).filter((p) => p > 0);
  const personCount = Math.max(profiles.length, 1);

  if (prices.length === 0) {
    return {
      avgPerPerson: 150,
      range: [50, 300],
      sensitivity: 'medium',
      preferredRange: '¥100-200/人',
    };
  }

  const perPersonPrices = prices.map((p) => p / personCount);
  const avg = perPersonPrices.reduce((a, b) => a + b, 0) / perPersonPrices.length;
  const min = Math.min(...perPersonPrices);
  const max = Math.max(...perPersonPrices);

  // 价格敏感度：基于用户 budget 字段
  const hasBudgetPref = profiles.some((p) => p.budget === '低' || p.budget === '经济');
  const sensitivity = hasBudgetPref ? 'high' : avg > 200 ? 'low' : 'medium';

  return {
    avgPerPerson: Math.round(avg),
    range: [Math.round(min), Math.round(max)],
    sensitivity,
    preferredRange: `¥${Math.round(avg * 0.7)}-${Math.round(avg * 1.3)}/人`,
  };
}

function analyzeTimePreferences(
  plans: Plan[],
  sessions: TaskSession[]
): TravelDNA['timePreferences'] {
  const safePlans = Array.isArray(plans) ? plans : [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  // 从 sessions 中提取 timePref
  const timePrefs = safeSessions.map((s) => s.timePref).filter(Boolean);
  const morningCount = timePrefs.filter((t) => t?.includes('上午')).length;
  const afternoonCount = timePrefs.filter((t) => t?.includes('下午')).length;
  const eveningCount = timePrefs.filter((t) => t?.includes('晚上')).length;

  const maxPref = Math.max(morningCount, afternoonCount, eveningCount, 1);
  let preferredStart = '下午';
  if (morningCount === maxPref && morningCount > 0) preferredStart = '上午';
  else if (eveningCount === maxPref && eveningCount > 0) preferredStart = '晚上';

  // 平均时长
  const durations = safePlans.map((p) => {
    const tag = p.durationTags;
    if (!tag || typeof tag !== 'string') return 4;
    const match = tag.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 4;
  });
  const avgDuration =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 4;

  return {
    preferredStart,
    avgDuration: Math.round(avgDuration * 10) / 10,
    weekendVsWeekday: 0.8, // 默认偏好周末
  };
}

function analyzeTravelPatterns(
  plans: Plan[],
  taskStates: PlannerTaskState[],
  profiles: PersonProfile[]
): TravelDNA['travelPatterns'] {
  const completedPlans = taskStates.filter(
    (t) => t.status === 'completed' || t.status === 'archived'
  );
  const lastUpdate = taskStates.reduce((max, t) => Math.max(max, t.lastUpdatedAt || 0), 0);
  const lastTripDaysAgo =
    lastUpdate > 0 ? Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60 * 24)) : 999;

  // 出行频率
  const tripCount = completedPlans.length;
  let frequency: 'rare' | 'monthly' | 'weekly' = 'rare';
  if (tripCount >= 8) frequency = 'weekly';
  else if (tripCount >= 2) frequency = 'monthly';

  return {
    frequency,
    groupSize: Math.max(profiles.length, 1),
    soloVsGroup: profiles.length > 1 ? 0.8 : 0.2,
    lastTripDaysAgo,
  };
}

function inferStyleTags(dna: Partial<TravelDNA>): string[] {
  const tags: string[] = [];

  if (dna.activityPreferences && dna.activityPreferences.food > 0.5) tags.push('美食爱好者');
  if (dna.activityPreferences && dna.activityPreferences.activity > 0.6) tags.push('探索型');
  if (dna.budgetProfile && dna.budgetProfile.sensitivity === 'high') tags.push('精打细算');
  if (dna.budgetProfile && dna.budgetProfile.sensitivity === 'low') tags.push('品质优先');
  if (dna.timePreferences && dna.timePreferences.avgDuration <= 3) tags.push('快节奏');
  if (dna.timePreferences && dna.timePreferences.avgDuration >= 6) tags.push('深度游');
  if (dna.travelPatterns && dna.travelPatterns.soloVsGroup > 0.6) tags.push('社交型');
  if (dna.travelPatterns && dna.travelPatterns.soloVsGroup < 0.3) tags.push('独行侠');

  return tags.length > 0 ? tags : ['均衡出行'];
}

// ── 公开 API ──

/**
 * 从历史数据生成 Travel DNA
 */
export function generateTravelDNA(
  plans: Plan[],
  taskStates: PlannerTaskState[],
  sessions: TaskSession[],
  profiles: PersonProfile[]
): TravelDNA {
  const activityPreferences = analyzeActivityPreferences(plans, taskStates);
  const budgetProfile = analyzeBudgetProfile(plans, profiles);
  const timePreferences = analyzeTimePreferences(plans, sessions);
  const travelPatterns = analyzeTravelPatterns(plans, taskStates, profiles);
  const styleTags = inferStyleTags({
    activityPreferences,
    budgetProfile,
    timePreferences,
    travelPatterns,
  });

  const completedCount = taskStates.filter((t) => t.status === 'completed').length;
  const safePlans = Array.isArray(plans) ? plans : [];
  const safeTaskStates = Array.isArray(taskStates) ? taskStates : [];
  const totalActivities = safePlans.reduce((sum, p) => sum + (p.activities?.length || 0), 0);
  const completedActivities = safeTaskStates.reduce(
    (sum, t) => sum + (t.completedActivityIds?.length || 0),
    0
  );

  // 置信度：基于数据量
  const dataPoints = safePlans.length + completedCount;
  const confidence = Math.min(1, dataPoints / 10); // 10 个数据点时达到满置信度

  return {
    activityPreferences,
    budgetProfile,
    timePreferences,
    travelPatterns,
    styleTags,
    meta: {
      analyzedTrips: safePlans.length,
      totalActivities,
      completionRate: totalActivities > 0 ? completedActivities / totalActivities : 0,
      confidence: Math.round(confidence * 100) / 100,
      lastUpdated: Date.now(),
    },
  };
}

/**
 * 将 Travel DNA 序列化为 AI prompt 上下文
 */
export function dnaToPromptContext(dna: TravelDNA): string {
  const sections: string[] = [];

  sections.push(`【用户画像】`);
  sections.push(`风格标签：${dna.styleTags.join('、')}`);
  sections.push(
    `出行频率：${dna.travelPatterns.frequency === 'weekly' ? '每周' : dna.travelPatterns.frequency === 'monthly' ? '每月' : '偶尔'}出行`
  );
  sections.push(`平均人数：${dna.travelPatterns.groupSize}人`);

  sections.push(`\n【活动偏好】`);
  sections.push(`餐饮占比：${Math.round(dna.activityPreferences.food * 100)}%`);
  sections.push(`活动占比：${Math.round(dna.activityPreferences.activity * 100)}%`);
  if (dna.activityPreferences.topCategories.length > 0) {
    sections.push(`常去类别：${dna.activityPreferences.topCategories.join('、')}`);
  }

  sections.push(`\n【预算偏好】`);
  sections.push(`人均消费：¥${dna.budgetProfile.avgPerPerson}`);
  sections.push(
    `价格敏感度：${dna.budgetProfile.sensitivity === 'high' ? '高（注重性价比）' : dna.budgetProfile.sensitivity === 'low' ? '低（品质优先）' : '中等'}`
  );

  sections.push(`\n【时间偏好】`);
  sections.push(`偏好时段：${dna.timePreferences.preferredStart}`);
  sections.push(`平均时长：${dna.timePreferences.avgDuration}小时`);

  if (dna.meta.confidence < 0.3) {
    sections.push(
      `\n⚠️ 用户画像数据较少（置信度${Math.round(dna.meta.confidence * 100)}%），建议多提供通用推荐`
    );
  }

  return sections.join('\n');
}
