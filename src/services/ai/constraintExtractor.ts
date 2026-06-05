/**
 * ConstraintExtractor - 约束提取器
 *
 * 从用户输入和同行人画像中提取结构化约束条件，
 * 用于后续的行程编排和自检。
 *
 * 不依赖 LLM，纯规则提取，确保速度和确定性。
 */

import type { PersonProfile } from '../../types';

// ── 约束类型定义 ──

export interface TravelConstraints {
  // 时间约束
  timeWindow: {
    start: string; // "14:00"
    end: string; // "20:00"
    totalHours: number; // 6
  };

  // 人员约束
  people: Array<{
    role: string; // "self" | "wife" | "child" | "friend"
    ageGroup: string; // "adult" | "child" | "elderly"
    age?: number; // 具体年龄（如果已知）
    dietary: string[]; // 饮食限制
    mobility: string; // "normal" | "limited"
    specialNeeds: string[]; // 特殊需求
  }>;

  // 活动约束
  activity: {
    maxDurationMinutes: number; // 单个活动最大时长
    restIntervalMinutes: number; // 活动间休息时长
    maxWalkingDistanceMeters: number; // 最大步行距离
    preferredTypes: string[]; // 偏好活动类型
    avoidedTypes: string[]; // 回避活动类型
    maxActivities?: number; // 期望的活动数量
  };

  // 餐饮约束
  dining: {
    mealType: string; // "light" | "normal" | "heavy"
    dietaryRestrictions: string[];
    budgetPerPerson: number;
    preferredCategories: string[];
    avoidedCategories: string[];
    minMeals?: number; // 最少正餐数量
    requireCafe?: boolean; // 是否需要包含咖啡馆/下午茶
  };

  // 出行约束
  travel: {
    maxDistanceFromHome: string; // "30min车程"
    preferredMode: string; // "walking" | "driving" | "transit"
    hasChildren: boolean;
    hasElderly: boolean;
    hasMobilityLimited: boolean;
  };

  // 意图
  intent: string; // "family_outing" | "friends_gathering" | "date" | "solo"
}

// ── 时间解析 ──

function parseTimeFromQuery(query: string): { start: string; hours: number } {
  // 检测具体时间
  const timeMatch = query.match(/(\d{1,2})[点时:](\d{0,2})/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    return {
      start: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      hours: 6,
    };
  }

  // 检测时段
  if (/上午|早上/.test(query)) return { start: '09:00', hours: 4 };
  if (/下午/.test(query)) return { start: '14:00', hours: 6 };
  if (/晚上/.test(query)) return { start: '18:00', hours: 4 };
  if (/中午/.test(query)) return { start: '11:30', hours: 3 };
  if (/全天|一天|一整天/.test(query)) return { start: '09:00', hours: 10 };

  // 检测时长
  const durationMatch = query.match(/(\d+)\s*[个]?[小时h]/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1]);
    return { start: '14:00', hours: Math.min(hours, 12) };
  }

  // 默认下午
  return { start: '14:00', hours: 6 };
}

// ── 意图识别 ──

function detectIntent(query: string, profiles: PersonProfile[]): string {
  const hasChild = profiles.some((p) => p.ageGroup === '儿童' || p.relation === '孩子');
  const hasElderly = profiles.some((p) => p.ageGroup === '老年' || p.relation === '长辈');
  const isCouple = profiles.length === 2 && profiles.some((p) => p.relation === '伴侣');
  const isFriends = profiles.some((p) => p.relation === '朋友' || p.relation === '同事');

  if (/约会|情侣|浪漫/.test(query)) return 'date';
  if (hasChild || /亲子|家庭|带孩子/.test(query)) return 'family_outing';
  if (hasElderly) return 'family_outing';
  if (isCouple) return 'couple';
  if (isFriends || /朋友|聚会|聚餐/.test(query)) return 'friends_gathering';
  if (/独自|一个人|独处/.test(query)) return 'solo';

  return profiles.length > 1 ? 'group_outing' : 'solo';
}

// ── 约束推导 ──

function deriveActivityConstraints(
  profiles: PersonProfile[],
  intent: string
): TravelConstraints['activity'] {
  const hasChild = profiles.some((p) => p.ageGroup === '儿童');
  const hasElderly = profiles.some((p) => p.ageGroup === '老年');
  const hasMobilityLimited = profiles.some((p) => p.mobility && p.mobility !== '正常');

  let maxDuration = 120; // 默认 2 小时
  let restInterval = 10; // 默认 10 分钟
  let maxWalking = 2000; // 默认 2km

  if (hasChild) {
    maxDuration = 120; // 儿童：每个活动 ≤2h
    restInterval = 20; // 儿童：休息 20min
    maxWalking = 1000; // 儿童：步行 ≤1km
  }

  if (hasElderly) {
    maxDuration = 90; // 老人：每个活动 ≤1.5h
    restInterval = 15; // 老人：休息 15min
    maxWalking = 800; // 老人：步行 ≤800m
  }

  if (hasMobilityLimited) {
    maxDuration = 60;
    restInterval = 20;
    maxWalking = 500;
  }

  // 从 specialNeeds 中提取
  for (const p of profiles) {
    if (p.specialNeeds?.includes('午休')) {
      restInterval = Math.max(restInterval, 30);
    }
    if (p.specialNeeds?.includes('婴儿车')) {
      maxWalking = Math.min(maxWalking, 800);
    }
  }

  // 偏好和回避
  const preferredTypes: string[] = [];
  const avoidedTypes: string[] = [];

  if (hasChild) {
    preferredTypes.push('亲子乐园', '室内游乐', '动物园', '水族馆');
    avoidedTypes.push('酒吧', '夜店', 'KTV');
  }

  if (intent === 'date') {
    preferredTypes.push('咖啡馆', '西餐厅', '电影院');
  }

  // 从 travelPreferences 推导
  for (const p of profiles) {
    for (const pref of p.travelPreferences || []) {
      if (/亲子|儿童|游乐/.test(pref)) preferredTypes.push('亲子');
      if (/拍照|摄影/.test(pref)) preferredTypes.push('网红打卡');
      if (/文艺|展览|艺术/.test(pref)) preferredTypes.push('展览');
      if (/美食|吃货/.test(pref)) preferredTypes.push('美食');
    }
    for (const avoid of p.avoidPreferences || []) {
      avoidedTypes.push(avoid);
    }
  }

  return {
    maxDurationMinutes: maxDuration,
    restIntervalMinutes: restInterval,
    maxWalkingDistanceMeters: maxWalking,
    preferredTypes: [...new Set(preferredTypes)],
    avoidedTypes: [...new Set(avoidedTypes)],
  };
}

function deriveDiningConstraints(profiles: PersonProfile[]): TravelConstraints['dining'] {
  const dietaryRestrictions: string[] = [];
  const preferredCategories: string[] = [];
  const avoidedCategories: string[] = [];

  for (const p of profiles) {
    // 饮食偏好
    for (const d of p.dietaryPreferences || []) {
      if (/减肥|低卡|轻食|沙拉/.test(d)) {
        dietaryRestrictions.push('低卡');
        preferredCategories.push('轻食', '沙拉');
        avoidedCategories.push('火锅', '烧烤', '自助餐');
      }
      if (/素食/.test(d)) {
        dietaryRestrictions.push('素食');
        preferredCategories.push('素食');
      }
      if (/不吃辣|微辣/.test(d)) {
        dietaryRestrictions.push('不吃辣');
        avoidedCategories.push('川菜', '湘菜', '火锅');
      }
      if (/低碳水/.test(d)) {
        dietaryRestrictions.push('低碳水');
      }
      if (/高蛋白/.test(d)) {
        preferredCategories.push('高蛋白');
      }
      if (/过敏/.test(d)) {
        dietaryRestrictions.push(d);
      }
    }

    // 儿童特殊需求
    if (p.ageGroup === '儿童') {
      preferredCategories.push('亲子餐厅', '儿童友好');
      avoidedCategories.push('酒吧', '居酒屋');
    }
  }

  // 计算人均预算
  const budgets = profiles.map((p) => {
    if (p.budget === '经济') return 50;
    if (p.budget === '较高') return 200;
    if (p.budget === '不限') return 300;
    return 100; // 中等
  });
  const avgBudget = Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length);

  return {
    mealType: dietaryRestrictions.includes('低卡') ? 'light' : 'normal',
    dietaryRestrictions: [...new Set(dietaryRestrictions)],
    budgetPerPerson: avgBudget,
    preferredCategories: [...new Set(preferredCategories)],
    avoidedCategories: [...new Set(avoidedCategories)],
  };
}

function deriveTravelConstraints(
  profiles: PersonProfile[],
  query: string
): TravelConstraints['travel'] {
  const hasChildren = profiles.some((p) => p.ageGroup === '儿童');
  const hasElderly = profiles.some((p) => p.ageGroup === '老年');
  const hasMobilityLimited = profiles.some((p) => p.mobility && p.mobility !== '正常');

  // 从查询中推断距离
  let maxDistance = '30min车程';
  if (/不远|附近|周边|家门口/.test(query)) maxDistance = '15min车程';
  if (/远处|远一点|郊区/.test(query)) maxDistance = '60min车程';

  // 推断交通方式
  let preferredMode = 'driving';
  if (/地铁|公交|公共交通/.test(query)) preferredMode = 'transit';
  if (/步行|走路|散步/.test(query)) preferredMode = 'walking';
  if (hasChildren || hasElderly) preferredMode = 'driving'; // 有儿童/老人默认驾车

  return {
    maxDistanceFromHome: maxDistance,
    preferredMode,
    hasChildren,
    hasElderly,
    hasMobilityLimited,
  };
}

// ── 主函数 ──

/**
 * 从用户输入和同行人画像中提取结构化约束
 */
export function extractConstraints(
  query: string,
  profiles: PersonProfile[],
  timePref?: string
): TravelConstraints {
  // 时间约束
  const timeInfo = parseTimeFromQuery(query);
  const startTime = timePref || timeInfo.start;
  const startHour = parseInt(startTime.split(':')[0]);
  const startMinute = parseInt(startTime.split(':')[1] || '0');
  const endMinute = startHour * 60 + startMinute + timeInfo.hours * 60;
  const endHour = Math.min(Math.floor(endMinute / 60), 23);
  const endTime = `${endHour.toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;

  // 意图识别
  const intent = detectIntent(query, profiles);

  // 从 query 智能推导期望活动数
  let expectedActivities: number | undefined;
  if (/深度|满满|充实|全天|一整天/.test(query)) {
    expectedActivities = 5;
  } else if (/随便|简单|逛逛|透透气/.test(query)) {
    expectedActivities = 2;
  } else if (/约会|情侣|浪漫/.test(query)) {
    expectedActivities = 3; // 约会场景舒缓节奏
  } else if (/吃|美食|探店|小吃/.test(query)) {
    expectedActivities = 3; // 美食场景以餐饮为主
  } else {
    expectedActivities = 3;
  }

  // 推导约束
  const activityConstraints = {
    ...deriveActivityConstraints(profiles, intent),
    maxActivities: expectedActivities,
  };

  let diningConstraints = deriveDiningConstraints(profiles);

  // 约会场景的餐饮约束（建议性，非硬性）
  if (intent === 'date' || /约会|情侣|浪漫/.test(query)) {
    diningConstraints = {
      ...diningConstraints,
      requireCafe: true, // 建议包含咖啡馆/下午茶，增加浪漫氛围
    };
  }

  // 美食探索场景的约束
  if (/吃|美食|探店|小吃/.test(query)) {
    diningConstraints = {
      ...diningConstraints,
      preferredCategories: [
        ...(diningConstraints.preferredCategories || []),
        '特色美食',
        '小吃街',
        '网红餐厅',
      ],
    };
  }

  const travelConstraints = deriveTravelConstraints(profiles, query);

  // 构建人员列表
  const people = profiles.map((p) => ({
    role: p.relation,
    ageGroup: p.ageGroup === '儿童' ? 'child' : p.ageGroup === '老年' ? 'elderly' : 'adult',
    age: p.ageGroup === '儿童' ? 5 : undefined, // 默认值
    dietary: p.dietaryPreferences || [],
    mobility: p.mobility || 'normal',
    specialNeeds: p.specialNeeds || [],
  }));

  return {
    timeWindow: {
      start: startTime,
      end: endTime,
      totalHours: timeInfo.hours,
    },
    people,
    activity: activityConstraints,
    dining: diningConstraints,
    travel: travelConstraints,
    intent,
  };
}

/**
 * 将约束转换为 prompt 上下文
 */
export function constraintsToPromptContext(constraints: TravelConstraints): string {
  const sections: string[] = [];

  sections.push('【行程约束】');
  sections.push(
    `时间窗口：${constraints.timeWindow.start} - ${constraints.timeWindow.end}（${constraints.timeWindow.totalHours}小时）`
  );
  sections.push(`人数：${constraints.people.length}人`);
  sections.push(`场景：${constraints.intent}`);

  // 人员详情
  if (constraints.people.length > 1) {
    sections.push('\n【同行人约束】');
    for (const p of constraints.people) {
      const parts = [p.role, p.ageGroup];
      if (p.dietary.length > 0) parts.push(`饮食:${p.dietary.join(',')}`);
      if (p.specialNeeds.length > 0) parts.push(`需求:${p.specialNeeds.join(',')}`);
      sections.push(`- ${parts.join('，')}`);
    }
  }

  // 活动约束
  sections.push('\n【活动约束】');
  sections.push(`单个活动最长：${constraints.activity.maxDurationMinutes}分钟`);
  sections.push(`活动间休息：${constraints.activity.restIntervalMinutes}分钟`);
  sections.push(`最大步行距离：${constraints.activity.maxWalkingDistanceMeters}米`);
  if (constraints.activity.preferredTypes.length > 0) {
    sections.push(`偏好类型：${constraints.activity.preferredTypes.join('、')}`);
  }
  if (constraints.activity.avoidedTypes.length > 0) {
    sections.push(`回避类型：${constraints.activity.avoidedTypes.join('、')}`);
  }

  // 餐饮约束
  sections.push('\n【餐饮约束】');
  sections.push(`餐饮类型：${constraints.dining.mealType === 'light' ? '轻食/低卡' : '正常'}`);
  if (constraints.dining.dietaryRestrictions.length > 0) {
    sections.push(`饮食限制：${constraints.dining.dietaryRestrictions.join('、')}`);
  }
  sections.push(`人均预算：¥${constraints.dining.budgetPerPerson}`);
  if (constraints.dining.preferredCategories.length > 0) {
    sections.push(`偏好餐厅：${constraints.dining.preferredCategories.join('、')}`);
  }
  if (constraints.dining.avoidedCategories.length > 0) {
    sections.push(`回避餐厅：${constraints.dining.avoidedCategories.join('、')}`);
  }

  // 出行约束
  sections.push('\n【出行约束】');
  sections.push(`最远距离：${constraints.travel.maxDistanceFromHome}`);
  sections.push(`交通方式：${constraints.travel.preferredMode}`);

  return sections.join('\n');
}
