/**
 * ConstraintSolver - 约束求解器
 *
 * 阶段 3：在 LLM 生成行程后，用约束求解算法验证并优化活动组合。
 *
 * 职责：
 * 1. 时间分配：根据约束为每个活动生成合理的时间段
 * 2. 顺序优化：调整活动顺序以满足"轻→重→餐→轻"的体力梯度
 * 3. 间隔保证：确保活动之间有足够的休息间隔
 * 4. 类型平衡：确保餐饮和活动的比例合理
 */

import type { Plan, Activity } from './types';
import type { TravelConstraints } from './constraintExtractor';

// ── 时间工具 ──

function parseTime(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseActivityDuration(activity: Activity): number {
  if (!activity.timeLine) return 60;
  const parts = activity.timeLine.split('-').map((s) => s.trim());
  if (parts.length !== 2) return 60;
  return Math.abs(parseTime(parts[1]) - parseTime(parts[0]));
}

// ── 活动强度分类 ──

type IntensityLevel = 'light' | 'medium' | 'heavy';

function classifyIntensity(activity: Activity): IntensityLevel {
  const text =
    `${activity.title} ${activity.description || ''} ${activity.tags?.join(' ') || ''}`.toLowerCase();

  // 重体力
  if (/游乐园|过山车|跳楼机|攀岩|滑雪|水上乐园|爬山|徒步|长城/.test(text)) {
    return 'heavy';
  }
  // 轻体力
  if (/咖啡|下午茶|展览|博物馆|书店|公园|散步|电影院|茶馆/.test(text)) {
    return 'light';
  }
  // 餐饮
  if (activity.type === 'food') {
    return 'light';
  }
  // 默认中等
  return 'medium';
}

// ── 时间分配算法 ──

function allocateTimeSlots(activities: Activity[], constraints: TravelConstraints): Activity[] {
  if (activities.length === 0) return activities;

  const startTime = parseTime(constraints.timeWindow.start);
  const endTime = parseTime(constraints.timeWindow.end);
  const maxDuration = constraints.activity.maxDurationMinutes;
  const restInterval = constraints.activity.restIntervalMinutes;

  const result: Activity[] = [];
  let currentTime = startTime;

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const duration = Math.min(parseActivityDuration(activity), maxDuration);

    // 检查是否超出时间窗口
    if (currentTime + duration > endTime) {
      // 尝试缩短时长
      const remaining = endTime - currentTime;
      if (remaining < 30) break; // 不到 30 分钟，跳过
      const adjustedDuration = remaining;
      result.push({
        ...activity,
        timeLine: `${formatTime(currentTime)}-${formatTime(currentTime + adjustedDuration)}`,
      });
      currentTime += adjustedDuration;
      break;
    }

    result.push({
      ...activity,
      timeLine: `${formatTime(currentTime)}-${formatTime(currentTime + duration)}`,
    });

    currentTime += duration;

    // 添加休息间隔（最后一个活动除外）
    if (i < activities.length - 1) {
      currentTime += restInterval;
    }
  }

  return result;
}

// ── 顺序优化算法 ──

function optimizeSequence(activities: Activity[], constraints: TravelConstraints): Activity[] {
  if (activities.length <= 2) return activities;

  // 按强度分类
  const classified = activities.map((a) => ({
    activity: a,
    intensity: classifyIntensity(a),
    type: a.type,
  }));

  // 构建理想顺序：轻体力 → 中体力 → 餐饮 → 轻体力
  const lightActivities = classified.filter((c) => c.intensity === 'light' && c.type !== 'food');
  const mediumActivities = classified.filter((c) => c.intensity === 'medium');
  const heavyActivities = classified.filter((c) => c.intensity === 'heavy');
  const foodActivities = classified.filter((c) => c.type === 'food');

  // 策略：轻 → (中/重) → 餐饮 → 轻
  const sequence: typeof classified = [];

  // 开场：轻体力活动
  if (lightActivities.length > 0) {
    sequence.push(lightActivities[0]);
  }

  // 中间：中/重体力活动
  sequence.push(...mediumActivities);
  sequence.push(...heavyActivities);

  // 餐饮：安排在中后段
  sequence.push(...foodActivities);

  // 结尾：轻体力活动（如果有剩余）
  if (lightActivities.length > 1) {
    sequence.push(...lightActivities.slice(1));
  }

  // 如果分类后为空，保持原顺序
  if (sequence.length === 0) return activities;

  return sequence.map((c) => c.activity);
}

// ── 间隔保证 ──

function ensureRestIntervals(activities: Activity[], constraints: TravelConstraints): Activity[] {
  if (activities.length <= 1) return activities;

  const restInterval = constraints.activity.restIntervalMinutes;
  const result: Activity[] = [activities[0]];

  for (let i = 1; i < activities.length; i++) {
    const prev = result[result.length - 1];
    const curr = activities[i];

    if (!prev.timeLine || !curr.timeLine) {
      result.push(curr);
      continue;
    }

    const prevEnd = parseTime(prev.timeLine.split('-')[1].trim());
    const currStart = parseTime(curr.timeLine.split('-')[0].trim());
    const gap = currStart - prevEnd;

    if (gap < restInterval) {
      // 调整当前活动的开始时间
      const newStart = prevEnd + restInterval;
      const duration = parseActivityDuration(curr);
      const newEnd = newStart + duration;

      result.push({
        ...curr,
        timeLine: `${formatTime(newStart)}-${formatTime(newEnd)}`,
      });
    } else {
      result.push(curr);
    }
  }

  return result;
}

// ── 类型平衡检查 ──

function checkTypeBalance(activities: Activity[]): {
  balanced: boolean;
  foodCount: number;
  activityCount: number;
  drinksCount: number;
  suggestion?: string;
} {
  const DRINKS_PATTERN =
    /咖啡|coffee|cafe|奶茶|茶饮|甜品|dessert|下午茶|饮品|果汁|星巴克|瑞幸|manner|喜茶|奈雪|茶百道|霸王茶姬|沪上阿姨/i;
  const foodActivities = activities.filter((a) => a.type === 'food');
  const foodCount = foodActivities.length;
  const activityCount = activities.filter((a) => a.type === 'activity').length;
  const drinksCount = foodActivities.filter((a) =>
    DRINKS_PATTERN.test(`${a.title} ${a.description || ''}`)
  ).length;

  if (activities.length >= 3 && foodCount === 0) {
    return {
      balanced: false,
      foodCount,
      activityCount,
      drinksCount,
      suggestion: '建议添加至少一个餐饮活动',
    };
  }

  if (drinksCount >= 2) {
    return {
      balanced: false,
      foodCount,
      activityCount,
      drinksCount,
      suggestion: `饮品活动过多（${drinksCount}次），建议每天最多1次咖啡/下午茶，其余替换为正餐或景点`,
    };
  }

  const mealCount = foodCount - drinksCount;
  if (foodCount >= 2 && mealCount === 0) {
    return {
      balanced: false,
      foodCount,
      activityCount,
      drinksCount,
      suggestion: '所有餐饮都是饮品，建议至少安排一顿正餐',
    };
  }

  if (foodCount > activityCount && activities.length > 2) {
    return {
      balanced: false,
      foodCount,
      activityCount,
      drinksCount,
      suggestion: '餐饮活动过多，建议增加游玩活动',
    };
  }

  return { balanced: true, foodCount, activityCount, drinksCount };
}

// ── 主函数 ──

/**
 * 约束求解：优化行程的活动组合和时间安排
 */
export function solveConstraints(
  plan: Plan,
  constraints: TravelConstraints
): {
  optimizedPlan: Plan;
  changes: string[];
} {
  const changes: string[] = [];
  let activities = [...plan.activities];

  // 1. 顺序优化
  const originalOrder = activities.map((a) => a.title).join(' → ');
  activities = optimizeSequence(activities, constraints);
  const newOrder = activities.map((a) => a.title).join(' → ');
  if (originalOrder !== newOrder) {
    changes.push('优化了活动顺序（轻→重→餐→轻）');
  }

  // 2. 时间分配
  const originalTimeLines = activities.map((a) => a.timeLine);
  activities = allocateTimeSlots(activities, constraints);
  const hasTimeChanges = activities.some((a, i) => a.timeLine !== originalTimeLines[i]);
  if (hasTimeChanges) {
    changes.push(`重新分配了时间（每个活动 ≤${constraints.activity.maxDurationMinutes}分钟）`);
  }

  // 3. 间隔保证
  activities = ensureRestIntervals(activities, constraints);
  changes.push(`确保活动间有 ${constraints.activity.restIntervalMinutes} 分钟休息`);

  // 4. 类型平衡检查
  const balance = checkTypeBalance(activities);
  if (!balance.balanced && balance.suggestion) {
    changes.push(balance.suggestion);
  }

  // 计算新的总价
  const totalPrice = activities.reduce((sum, a) => sum + (a.price || 0), 0);

  return {
    optimizedPlan: {
      ...plan,
      activities,
      totalPrice: totalPrice || plan.totalPrice,
    },
    changes,
  };
}

/**
 * 将约束求解结果转换为 prompt 上下文
 */
export function solverChangesToContext(changes: string[]): string {
  if (changes.length === 0) return '';
  return `\n【行程优化调整】\n${changes.map((c) => `- ${c}`).join('\n')}`;
}
