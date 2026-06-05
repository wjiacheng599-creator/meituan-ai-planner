/**
 * UnifiedUserProfile - 统一用户画像
 *
 * 合并 travelDNA + userPreference + 行为事件，生成 12 维度的统一画像。
 * 参考 TravelAgent 论文的 Memory Module 设计。
 */

import type { TravelDNA } from './travelDNA';
import type { UserPreference } from '../userPreference';

// ── 行为事件类型（与后端一致） ──

interface BehaviorEvent {
  id: string;
  type: string;
  planId: string | null;
  activityId: string | null;
  metadata: Record<string, unknown>;
  timestamp: number;
}

// ── 统一画像类型 ──

export interface UnifiedUserProfile {
  // 来自 travelDNA（历史行程分析）
  activityPreferences: TravelDNA['activityPreferences'];
  budgetProfile: TravelDNA['budgetProfile'];
  timePreferences: TravelDNA['timePreferences'];
  travelPatterns: TravelDNA['travelPatterns'];
  styleTags: string[];

  // 来自 userPreference（显式声明）
  favoriteCategories: string[];
  avoidCategories: string[];
  dietaryRestrictions: string[];

  // 来自行为事件（隐式学习）
  locationPreferences: {
    topCities: string[];
    topAreas: string[];
    preferredDistance: number;
  };
  brandPreferences: {
    favoriteBrands: string[];
    avoidedBrands: string[];
  };
  decisionStyle: {
    avgDecisionTime: number;
    selectRate: number;
    completionRate: number;
  };

  // 行为洞察
  behaviorInsights: string[];

  // 元数据
  meta: {
    confidence: number;
    dataPoints: number;
    lastUpdated: number;
  };
}

// ── 合并函数 ──

export function buildUnifiedProfile(params: {
  travelDNA: TravelDNA | null;
  userPreference: UserPreference | null;
  behaviorEvents: BehaviorEvent[];
}): UnifiedUserProfile {
  const { travelDNA, userPreference, behaviorEvents } = params;

  // 默认值
  const defaultProfile: UnifiedUserProfile = {
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
      sensitivity: 'medium',
      preferredRange: '¥100-200/人',
    },
    timePreferences: {
      preferredStart: '下午',
      avgDuration: 4,
      weekendVsWeekday: 0.8,
    },
    travelPatterns: {
      frequency: 'rare',
      groupSize: 1,
      soloVsGroup: 0.5,
      lastTripDaysAgo: 999,
    },
    styleTags: ['均衡出行'],
    favoriteCategories: [],
    avoidCategories: [],
    dietaryRestrictions: [],
    locationPreferences: {
      topCities: [],
      topAreas: [],
      preferredDistance: 2000,
    },
    brandPreferences: {
      favoriteBrands: [],
      avoidedBrands: [],
    },
    decisionStyle: {
      avgDecisionTime: 0,
      selectRate: 0,
      completionRate: 0,
    },
    behaviorInsights: [],
    meta: {
      confidence: 0,
      dataPoints: 0,
      lastUpdated: Date.now(),
    },
  };

  // 如果没有任何数据，返回默认值
  if (!travelDNA && !userPreference && behaviorEvents.length === 0) {
    return defaultProfile;
  }

  // 1. 合并 travelDNA
  const profile = { ...defaultProfile };
  if (travelDNA) {
    profile.activityPreferences = travelDNA.activityPreferences;
    profile.budgetProfile = travelDNA.budgetProfile;
    profile.timePreferences = travelDNA.timePreferences;
    profile.travelPatterns = travelDNA.travelPatterns;
    profile.styleTags = travelDNA.styleTags;
    profile.meta.confidence = travelDNA.meta.confidence;
    profile.meta.dataPoints = travelDNA.meta.analyzedTrips;
  }

  // 2. 合并 userPreference（显式声明优先级更高）
  if (userPreference) {
    if (userPreference.favoriteCategories.length > 0) {
      profile.favoriteCategories = userPreference.favoriteCategories;
      // 显式偏好覆盖隐式分析
      profile.activityPreferences.topCategories = [
        ...new Set([
          ...userPreference.favoriteCategories,
          ...profile.activityPreferences.topCategories,
        ]),
      ].slice(0, 8);
    }
    if (userPreference.avoidCategories.length > 0) {
      profile.avoidCategories = userPreference.avoidCategories;
      profile.activityPreferences.avoidedCategories = [
        ...new Set([
          ...userPreference.avoidCategories,
          ...profile.activityPreferences.avoidedCategories,
        ]),
      ];
    }
    if (userPreference.dietaryRestrictions.length > 0) {
      profile.dietaryRestrictions = userPreference.dietaryRestrictions;
    }
    if (userPreference.priceRange.max < 1000) {
      profile.budgetProfile.range = [userPreference.priceRange.min, userPreference.priceRange.max];
      profile.budgetProfile.avgPerPerson = Math.round(
        (userPreference.priceRange.min + userPreference.priceRange.max) / 2
      );
    }
    if (userPreference.preferredTime !== 'any') {
      const timeMap: Record<string, string> = {
        morning: '上午',
        afternoon: '下午',
        evening: '晚上',
      };
      profile.timePreferences.preferredStart = timeMap[userPreference.preferredTime] || '下午';
    }
  }

  // 3. 从行为事件中提取隐式偏好
  if (behaviorEvents.length > 0) {
    analyzeBehaviorEvents(behaviorEvents, profile);
  }

  // 4. 生成行为洞察
  profile.behaviorInsights = generateInsights(profile, behaviorEvents);

  // 5. 更新元数据
  profile.meta.lastUpdated = Date.now();

  return profile;
}

// ── 行为事件分析 ──

function analyzeBehaviorEvents(events: BehaviorEvent[], profile: UnifiedUserProfile): void {
  const recentEvents = events.filter(
    (e) => Date.now() - e.timestamp < 30 * 24 * 60 * 60 * 1000 // 30 天内
  );

  // 分析城市偏好
  const cityCount = new Map<string, number>();
  const areaCount = new Map<string, number>();
  const brandCount = new Map<string, number>();

  for (const event of recentEvents) {
    const meta = event.metadata;

    // 统计城市
    if (meta.city && typeof meta.city === 'string') {
      cityCount.set(meta.city, (cityCount.get(meta.city) || 0) + 1);
    }

    // 统计品牌/商家
    if (meta.activityTitle && typeof meta.activityTitle === 'string') {
      brandCount.set(meta.activityTitle, (brandCount.get(meta.activityTitle) || 0) + 1);
    }

    // 统计区域（从地址中提取）
    if (meta.address && typeof meta.address === 'string') {
      const area = extractArea(meta.address);
      if (area) areaCount.set(area, (areaCount.get(area) || 0) + 1);
    }
  }

  // 更新城市偏好
  const sortedCities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]);
  profile.locationPreferences.topCities = sortedCities.slice(0, 3).map(([city]) => city);

  // 更新区域偏好
  const sortedAreas = [...areaCount.entries()].sort((a, b) => b[1] - a[1]);
  profile.locationPreferences.topAreas = sortedAreas.slice(0, 5).map(([area]) => area);

  // 更新品牌偏好
  const selectEvents = recentEvents.filter((e) => e.type === 'select' || e.type === 'complete');
  const skipEvents = recentEvents.filter((e) => e.type === 'skip');

  const positiveBrands = new Map<string, number>();
  const negativeBrands = new Map<string, number>();

  for (const event of selectEvents) {
    const title = event.metadata.activityTitle;
    if (typeof title === 'string') {
      positiveBrands.set(title, (positiveBrands.get(title) || 0) + 1);
    }
  }
  for (const event of skipEvents) {
    const title = event.metadata.activityTitle;
    if (typeof title === 'string') {
      negativeBrands.set(title, (negativeBrands.get(title) || 0) + 1);
    }
  }

  profile.brandPreferences.favoriteBrands = [...positiveBrands.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([brand]) => brand);

  profile.brandPreferences.avoidedBrands = [...negativeBrands.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([brand]) => brand);

  // 分析决策风格
  const totalSelects = selectEvents.length;
  const totalSkips = skipEvents.length;
  const totalEvents = Math.max(totalSelects + totalSkips, 1);

  profile.decisionStyle.selectRate = Math.round((totalSelects / totalEvents) * 100);
  profile.decisionStyle.completionRate =
    profile.meta.confidence > 0 ? Math.round(profile.meta.confidence * 100) : 0;
}

// ── 行为洞察生成 ──

function generateInsights(profile: UnifiedUserProfile, events: BehaviorEvent[]): string[] {
  const insights: string[] = [];

  // 1. 风格洞察
  if (profile.styleTags.length > 0 && profile.styleTags[0] !== '均衡出行') {
    insights.push(`你的出行风格：${profile.styleTags.join('、')}`);
  }

  // 2. 预算洞察
  if (profile.budgetProfile.sensitivity === 'high') {
    insights.push('你比较注重性价比，推荐时会优先考虑实惠选项');
  } else if (profile.budgetProfile.sensitivity === 'low') {
    insights.push('你更注重品质，推荐时会优先考虑体验');
  }

  // 3. 类别偏好洞察
  if (profile.activityPreferences.topCategories.length > 0) {
    insights.push(`你常去：${profile.activityPreferences.topCategories.slice(0, 3).join('、')}`);
  }

  // 4. 品牌偏好洞察
  if (profile.brandPreferences.favoriteBrands.length > 0) {
    insights.push(
      `你常去的品牌：${profile.brandPreferences.favoriteBrands.slice(0, 2).join('、')}`
    );
  }

  // 5. 时间偏好洞察
  if (profile.timePreferences.preferredStart !== '下午') {
    insights.push(`你偏好${profile.timePreferences.preferredStart}出行`);
  }

  // 6. 出行模式洞察
  if (profile.travelPatterns.frequency === 'weekly') {
    insights.push('你是高频出行者，每周都会出门');
  } else if (profile.travelPatterns.frequency === 'monthly') {
    insights.push('你每月都会安排出行');
  }

  // 7. 饮食限制洞察
  if (profile.dietaryRestrictions.length > 0) {
    insights.push(`饮食限制：${profile.dietaryRestrictions.join('、')}`);
  }

  return insights.slice(0, 5); // 最多 5 条洞察
}

// ── 工具函数 ──

function extractArea(address: string): string | null {
  // 从地址中提取区域（如"朝阳区"、"三里屯"）
  const areaPatterns = [
    /([\u4e00-\u9fa5]+区)/,
    /([\u4e00-\u9fa5]+街道)/,
    /([\u4e00-\u9fa5]+路)/,
    /([\u4e00-\u9fa5]+街)/,
  ];

  for (const pattern of areaPatterns) {
    const match = address.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ── 导出为 prompt 上下文 ──

export function profileToPromptContext(profile: UnifiedUserProfile): string {
  const sections: string[] = [];

  sections.push('【用户画像】');
  sections.push(`风格：${profile.styleTags.join('、')}`);
  sections.push(`人均预算：¥${profile.budgetProfile.avgPerPerson}`);
  sections.push(`偏好时段：${profile.timePreferences.preferredStart}`);
  sections.push(`出行人数：${profile.travelPatterns.groupSize}人`);

  if (profile.activityPreferences.topCategories.length > 0) {
    sections.push(`常去类别：${profile.activityPreferences.topCategories.join('、')}`);
  }

  if (profile.dietaryRestrictions.length > 0) {
    sections.push(`饮食限制：${profile.dietaryRestrictions.join('、')}`);
  }

  if (profile.brandPreferences.favoriteBrands.length > 0) {
    sections.push(`常去品牌：${profile.brandPreferences.favoriteBrands.join('、')}`);
  }

  if (profile.locationPreferences.topCities.length > 0) {
    sections.push(`常去城市：${profile.locationPreferences.topCities.join('、')}`);
  }

  if (profile.behaviorInsights.length > 0) {
    sections.push('\n【行为洞察】');
    for (const insight of profile.behaviorInsights) {
      sections.push(`- ${insight}`);
    }
  }

  if (profile.meta.confidence < 0.3) {
    sections.push(
      `\n⚠️ 用户画像数据较少（置信度${Math.round(profile.meta.confidence * 100)}%），建议多提供通用推荐`
    );
  }

  return sections.join('\n');
}
