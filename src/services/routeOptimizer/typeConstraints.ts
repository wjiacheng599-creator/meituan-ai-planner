/**
 * 活动类型约束优化模块
 * 用于确保活动类型搭配合理，节奏合适
 */

import { calculateHaversineDistance, Coordinate } from './utils';

export type ActivityType = 'food' | 'activity' | 'travel' | 'shopping' | 'entertainment' | 'other';

export interface TypeConstrainedActivity {
  id: string;
  type: ActivityType;
  title: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

export interface TypeConstraintResult {
  isValid: boolean;
  issues: string[];
  optimizedActivities: TypeConstrainedActivity[];
}

/**
 * 活动类型识别：根据标题和类型字段确定活动类型
 * @param activity 活动对象
 * @returns 活动类型
 */
export function identifyActivityType(activity: Partial<TypeConstrainedActivity>): ActivityType {
  if (
    activity.type &&
    ['food', 'activity', 'travel', 'shopping', 'entertainment', 'other'].includes(activity.type)
  ) {
    return activity.type as ActivityType;
  }

  const titleLower = (activity.title || '').toLowerCase();

  const foodKeywords = [
    '餐',
    '饭',
    '馆',
    '店',
    '餐厅',
    '美食',
    '吃',
    'cafe',
    'restaurant',
    'food',
    'dining',
    'coffee',
    'tea',
    '甜点',
    '甜品',
  ];
  const shoppingKeywords = [
    '购物',
    '商场',
    '超市',
    '商店',
    '店',
    'shopping',
    'mall',
    'store',
    'market',
  ];
  const entertainmentKeywords = [
    '电影',
    '演出',
    '游戏',
    '娱乐',
    '娱乐',
    'entertainment',
    'movie',
    'show',
    'game',
  ];
  const travelKeywords = ['交通', '出行', '旅行', 'travel', 'transport', 'airport', 'station'];

  if (foodKeywords.some((keyword) => titleLower.includes(keyword))) {
    return 'food';
  }
  if (shoppingKeywords.some((keyword) => titleLower.includes(keyword))) {
    return 'shopping';
  }
  if (entertainmentKeywords.some((keyword) => titleLower.includes(keyword))) {
    return 'entertainment';
  }
  if (travelKeywords.some((keyword) => titleLower.includes(keyword))) {
    return 'travel';
  }

  return 'activity';
}

/**
 * 检测连续的相同类型活动
 * @param activities 活动数组
 * @returns 连续活动的位置和类型信息
 */
function detectConsecutiveSameTypes(
  activities: TypeConstrainedActivity[]
): Array<{ start: number; end: number; type: ActivityType }> {
  const consecutiveGroups: Array<{ start: number; end: number; type: ActivityType }> = [];

  if (activities.length < 2) {
    return consecutiveGroups;
  }

  let currentType = activities[0].type;
  let startIndex = 0;

  for (let i = 1; i < activities.length; i++) {
    if (activities[i].type !== currentType) {
      if (i - startIndex > 1) {
        consecutiveGroups.push({
          start: startIndex,
          end: i - 1,
          type: currentType,
        });
      }
      currentType = activities[i].type;
      startIndex = i;
    }
  }

  if (activities.length - startIndex > 1) {
    consecutiveGroups.push({
      start: startIndex,
      end: activities.length - 1,
      type: currentType,
    });
  }

  return consecutiveGroups;
}

/**
 * 计算两个活动之间的距离
 * @param activity1 第一个活动
 * @param activity2 第二个活动
 * @returns 距离（米）
 */
function calculateActivityDistance(
  activity1: TypeConstrainedActivity,
  activity2: TypeConstrainedActivity
): number {
  return calculateHaversineDistance(
    { lat: activity1.lat, lng: activity1.lng },
    { lat: activity2.lat, lng: activity2.lng }
  );
}

/**
 * 寻找距离指定位置最近的不同类型活动
 * @param activities 所有活动数组
 * @param referencePoint 参考位置
 * @param excludedTypes 需要排除的活动类型
 * @param usedIndices 已使用的活动索引
 * @returns 最近的活动索引，未找到则返回 -1
 */
function findNearestDifferentTypeActivity(
  activities: TypeConstrainedActivity[],
  referencePoint: Coordinate,
  excludedTypes: ActivityType[],
  usedIndices: Set<number>
): number {
  let nearestIndex = -1;
  let nearestDistance = Infinity;

  for (let i = 0; i < activities.length; i++) {
    if (usedIndices.has(i) || excludedTypes.includes(activities[i].type)) {
      continue;
    }

    const distance = calculateHaversineDistance(referencePoint, {
      lat: activities[i].lat,
      lng: activities[i].lng,
    });
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

/**
 * 调整连续的餐饮活动
 * @param activities 活动数组
 * @param consecutiveGroup 连续活动组信息
 * @param usedIndices 已使用的活动索引集合
 * @returns 调整后的活动数组
 */
function adjustConsecutiveFoodActivities(
  activities: TypeConstrainedActivity[],
  consecutiveGroup: { start: number; end: number; type: ActivityType },
  usedIndices: Set<number>
): TypeConstrainedActivity[] {
  const result = [...activities];
  const { start, end } = consecutiveGroup;
  const adjustedIndices = new Set(usedIndices);

  for (let i = start + 1; i <= end; i++) {
    const previousActivity = result[i - 1];
    const nearestActivityIndex = findNearestDifferentTypeActivity(
      result,
      { lat: previousActivity.lat, lng: previousActivity.lng },
      ['food'],
      adjustedIndices
    );

    if (nearestActivityIndex !== -1 && nearestActivityIndex !== i) {
      [result[i], result[nearestActivityIndex]] = [result[nearestActivityIndex], result[i]];
      adjustedIndices.add(nearestActivityIndex);
    }
  }

  return result;
}

/**
 * 调整连续的非餐饮活动
 * @param activities 活动数组
 * @param consecutiveGroup 连续活动组信息
 * @param usedIndices 已使用的活动索引集合
 * @returns 调整后的活动数组
 */
function adjustConsecutiveNonFoodActivities(
  activities: TypeConstrainedActivity[],
  consecutiveGroup: { start: number; end: number; type: ActivityType },
  usedIndices: Set<number>
): TypeConstrainedActivity[] {
  const result = [...activities];
  const { start, end, type } = consecutiveGroup;
  const adjustedIndices = new Set(usedIndices);

  const foodActivities = result
    .map((activity, index) => ({ activity, index }))
    .filter(({ activity, index }) => activity.type === 'food' && !adjustedIndices.has(index));

  if (foodActivities.length === 0) {
    return result;
  }

  const targetInsertIndex = start + 1;
  let nearestFoodIndex = -1;
  let nearestDistance = Infinity;

  for (const { activity, index } of foodActivities) {
    const referencePoint = result[targetInsertIndex - 1];
    const distance = calculateActivityDistance(referencePoint, activity);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestFoodIndex = index;
    }
  }

  if (nearestFoodIndex !== -1 && nearestFoodIndex > end) {
    const foodActivity = result.splice(nearestFoodIndex, 1)[0];
    result.splice(targetInsertIndex, 0, foodActivity);
  }

  return result;
}

/**
 * 检查并修复活动类型约束
 * @param activities 活动数组
 * @returns 检查结果和优化后的活动数组
 */
export function checkAndFixTypeConstraints(
  activities: TypeConstrainedActivity[]
): TypeConstraintResult {
  const issues: string[] = [];
  let optimizedActivities = activities.map((activity) => ({
    ...activity,
    type: identifyActivityType(activity),
  }));

  const consecutiveGroups = detectConsecutiveSameTypes(optimizedActivities);

  for (const group of consecutiveGroups) {
    const count = group.end - group.start + 1;
    issues.push(
      `发现 ${count} 个连续的 ${group.type} 类型活动（位置 ${group.start + 1} 到 ${group.end + 1}）`
    );
  }

  const usedIndices = new Set<number>();

  for (const group of consecutiveGroups) {
    if (group.type === 'food') {
      optimizedActivities = adjustConsecutiveFoodActivities(
        optimizedActivities,
        group,
        usedIndices
      );
    } else {
      optimizedActivities = adjustConsecutiveNonFoodActivities(
        optimizedActivities,
        group,
        usedIndices
      );
    }

    for (let i = group.start; i <= group.end; i++) {
      usedIndices.add(i);
    }
  }

  const afterGroups = detectConsecutiveSameTypes(optimizedActivities);
  if (afterGroups.length === 0 && consecutiveGroups.length > 0) {
    issues.push('已成功优化，活动类型搭配更加合理');
  }

  return {
    isValid: afterGroups.length === 0,
    issues,
    optimizedActivities,
  };
}

/**
 * 优化活动类型搭配，确保节奏合适
 * @param activities 活动数组
 * @returns 优化后的活动数组
 */
export function optimizeActivityTypeMix(
  activities: TypeConstrainedActivity[]
): TypeConstrainedActivity[] {
  const { optimizedActivities } = checkAndFixTypeConstraints(activities);
  return optimizedActivities;
}
