/**
 * 时间约束优化模块
 * 用于确保活动时间符合日常作息逻辑
 */

import { parseTimePeriod, getTimePeriodLabel, TimePeriod } from './utils';

export type MealType = 'breakfast' | 'lunch' | 'afternoon_tea' | 'dinner' | 'none';

export interface TimeConstrainedActivity {
  id: string;
  timeLine: string;
  type: 'activity' | 'food' | 'travel';
  title: string;
  [key: string]: unknown;
}

export interface TimeConstraintResult {
  isValid: boolean;
  issues: string[];
  optimizedActivities: TimeConstrainedActivity[];
}

/**
 * 根据活动类型和时间线判断餐点类型
 * @param activity 活动对象
 * @returns 餐点类型
 */
export function classifyMealType(activity: TimeConstrainedActivity): MealType {
  if (activity.type !== 'food') {
    return 'none';
  }

  const period = parseTimePeriod(activity.timeLine);
  const titleLower = activity.title.toLowerCase();
  const hasTeaKeyword = /下午茶|咖啡|tea|coffee|甜品|dessert/.test(titleLower);

  switch (period) {
    case 'morning':
      return 'breakfast';
    case 'forenoon':
      return hasTeaKeyword ? 'afternoon_tea' : 'none';
    case 'noon':
      return 'lunch';
    case 'afternoon':
      return hasTeaKeyword ? 'afternoon_tea' : 'none';
    case 'evening':
      return 'dinner';
    default:
      return 'none';
  }
}

/**
 * 从时间线中提取开始时间的小时数
 * @param timeLine 时间线字符串，格式如 "09:00-11:00"
 * @returns 小时数
 */
function extractStartHour(timeLine: string): number {
  const match = timeLine.match(/^(\d{2}):\d{2}/);
  if (!match) {
    return 12;
  }
  return parseInt(match[1], 10);
}

/**
 * 为活动分配排序权重
 * @param activity 活动对象
 * @returns 排序权重（数字越小越靠前）
 */
function getActivitySortWeight(activity: TimeConstrainedActivity): number {
  const mealType = classifyMealType(activity);
  const startHour = extractStartHour(activity.timeLine);

  switch (mealType) {
    case 'breakfast':
      return Math.min(startHour, 10);
    case 'lunch':
      return Math.max(startHour, 12);
    case 'afternoon_tea':
      return Math.max(startHour, 15);
    case 'dinner':
      return Math.max(startHour, 18);
    case 'none':
    default:
      return startHour;
  }
}

/**
 * 检查并修复时间约束
 * @param activities 活动数组
 * @returns 检查结果和优化后的活动数组
 */
export function checkAndFixTimeConstraints(
  activities: TimeConstrainedActivity[]
): TimeConstraintResult {
  const issues: string[] = [];
  const optimizedActivities = [...activities];

  // 分离餐饮活动和非餐饮活动
  const foodActivities = optimizedActivities.filter((a) => a.type === 'food');
  const nonFoodActivities = optimizedActivities.filter((a) => a.type !== 'food');

  // 检查餐饮活动的时间合理性
  for (const activity of foodActivities) {
    const mealType = classifyMealType(activity);
    const period = parseTimePeriod(activity.timeLine);
    const periodLabel = getTimePeriodLabel(period);

    if (mealType === 'breakfast' && period !== 'morning') {
      issues.push(`"${activity.title}" 被归类为早餐，但时间安排在${periodLabel}，建议调整到早晨`);
    } else if (mealType === 'lunch' && period !== 'noon') {
      issues.push(`"${activity.title}" 被归类为午餐，但时间安排在${periodLabel}，建议调整到中午`);
    } else if (mealType === 'dinner' && period !== 'evening') {
      issues.push(`"${activity.title}" 被归类为晚餐，但时间安排在${periodLabel}，建议调整到晚上`);
    } else if (mealType === 'afternoon_tea' && !['forenoon', 'afternoon'].includes(period)) {
      issues.push(
        `"${activity.title}" 被归类为下午茶，但时间安排在${periodLabel}，建议调整到上午或下午`
      );
    }
  }

  // 按时间权重重新排序所有活动
  optimizedActivities.sort((a, b) => {
    const weightA = getActivitySortWeight(a);
    const weightB = getActivitySortWeight(b);

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // 如果权重相同，按原始时间线排序
    const hourA = extractStartHour(a.timeLine);
    const hourB = extractStartHour(b.timeLine);
    return hourA - hourB;
  });

  // 检查排序后的时间顺序是否合理
  for (let i = 0; i < optimizedActivities.length - 1; i++) {
    const current = optimizedActivities[i];
    const next = optimizedActivities[i + 1];
    const currentHour = extractStartHour(current.timeLine);
    const nextHour = extractStartHour(next.timeLine);

    if (currentHour > nextHour) {
      issues.push(`活动顺序可能需要调整："${current.title}" 在 "${next.title}" 之后开始`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    optimizedActivities,
  };
}

/**
 * 确保餐点顺序符合日常作息（早→午→晚）
 * @param activities 活动数组
 * @returns 重新排序后的活动数组
 */
export function ensureMealOrder(activities: TimeConstrainedActivity[]): TimeConstrainedActivity[] {
  const breakfasts: TimeConstrainedActivity[] = [];
  const lunches: TimeConstrainedActivity[] = [];
  const afternoonTeas: TimeConstrainedActivity[] = [];
  const dinners: TimeConstrainedActivity[] = [];
  const others: TimeConstrainedActivity[] = [];

  for (const activity of activities) {
    const mealType = classifyMealType(activity);
    switch (mealType) {
      case 'breakfast':
        breakfasts.push(activity);
        break;
      case 'lunch':
        lunches.push(activity);
        break;
      case 'afternoon_tea':
        afternoonTeas.push(activity);
        break;
      case 'dinner':
        dinners.push(activity);
        break;
      case 'none':
      default:
        others.push(activity);
        break;
    }
  }

  // 将非餐饮活动按时间分配到合适的时间段
  const result: TimeConstrainedActivity[] = [];

  // 添加早餐及早餐前的活动
  result.push(...breakfasts);

  // 添加上午的非餐饮活动
  const morningActivities = others.filter((a) => extractStartHour(a.timeLine) < 12);
  result.push(
    ...morningActivities.sort((a, b) => extractStartHour(a.timeLine) - extractStartHour(b.timeLine))
  );

  // 添加午餐
  result.push(...lunches);

  // 添加下午的非餐饮活动和下午茶
  const afternoonActivities = others.filter((a) => {
    const hour = extractStartHour(a.timeLine);
    return hour >= 12 && hour < 18;
  });
  result.push(
    ...afternoonActivities.sort(
      (a, b) => extractStartHour(a.timeLine) - extractStartHour(b.timeLine)
    )
  );
  result.push(...afternoonTeas);

  // 添加晚餐
  result.push(...dinners);

  // 添加晚上的非餐饮活动
  const eveningActivities = others.filter((a) => extractStartHour(a.timeLine) >= 18);
  result.push(
    ...eveningActivities.sort((a, b) => extractStartHour(a.timeLine) - extractStartHour(b.timeLine))
  );

  return result;
}
