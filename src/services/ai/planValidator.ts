/**
 * PlanValidator - 行程自检器
 *
 * 检查生成的行程是否满足所有约束条件，
 * 不满足时提供修正建议或自动修正。
 *
 * 纯规则引擎，不依赖 LLM，确保速度和确定性。
 */

import type { Plan, Activity } from './types';
import type { TravelConstraints } from './constraintExtractor';

// ── 验证结果类型 ──

export interface ValidationIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: 'time' | 'distance' | 'dining' | 'activity' | 'budget' | 'constraint';
  message: string;
  activityId?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100，越高越好
  issues: ValidationIssue[];
  fixedPlan?: Plan; // 自动修正后的行程
  summary: string;
}

// ── 时间解析工具 ──

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

// ── 验证规则 ──

function validateTimeWindow(plan: Plan, constraints: TravelConstraints): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!plan.activities || plan.activities.length === 0) return issues;

  // 检查总时长
  const firstActivity = plan.activities.find((a) => a.timeLine);
  const lastActivity = [...plan.activities].reverse().find((a) => a.timeLine);

  if (firstActivity?.timeLine && lastActivity?.timeLine) {
    const start = parseTime(firstActivity.timeLine.split('-')[0].trim());
    const end = parseTime(lastActivity.timeLine.split('-')[1].trim());
    const totalHours = (end - start) / 60;

    if (totalHours > constraints.timeWindow.totalHours + 1) {
      issues.push({
        id: 'time_exceed',
        severity: 'warning',
        category: 'time',
        message: `总时长 ${totalHours.toFixed(1)} 小时，超出预期 ${constraints.timeWindow.totalHours} 小时`,
        suggestion: '考虑减少活动数量或缩短每个活动时长',
      });
    }

    if (totalHours < constraints.timeWindow.totalHours - 2) {
      issues.push({
        id: 'time_too_short',
        severity: 'info',
        category: 'time',
        message: `总时长 ${totalHours.toFixed(1)} 小时，比预期短很多`,
        suggestion: '考虑增加活动或延长某些活动时长',
      });
    }
  }

  return issues;
}

function validateActivityDuration(plan: Plan, constraints: TravelConstraints): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const activity of plan.activities) {
    if (!activity.timeLine) continue;

    const duration = parseActivityDuration(activity);

    if (duration > constraints.activity.maxDurationMinutes) {
      issues.push({
        id: `duration_exceed_${activity.id}`,
        severity: 'warning',
        category: 'activity',
        message: `"${activity.title}" 时长 ${duration} 分钟，超过限制 ${constraints.activity.maxDurationMinutes} 分钟`,
        activityId: activity.id,
        suggestion: `将时长缩短到 ${constraints.activity.maxDurationMinutes} 分钟以内`,
      });
    }
  }

  return issues;
}

function validateRestInterval(plan: Plan, constraints: TravelConstraints): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activitiesWithTime = plan.activities.filter((a) => a.timeLine);

  for (let i = 1; i < activitiesWithTime.length; i++) {
    const prev = activitiesWithTime[i - 1];
    const curr = activitiesWithTime[i];

    const prevEnd = parseTime(prev.timeLine!.split('-')[1].trim());
    const currStart = parseTime(curr.timeLine!.split('-')[0].trim());
    const gap = currStart - prevEnd;

    if (gap < constraints.activity.restIntervalMinutes) {
      issues.push({
        id: `rest_short_${curr.id}`,
        severity: 'warning',
        category: 'time',
        message: `"${prev.title}" 和 "${curr.title}" 之间只有 ${gap} 分钟间隔，建议至少 ${constraints.activity.restIntervalMinutes} 分钟`,
        activityId: curr.id,
        suggestion: `将 "${curr.title}" 的开始时间推后到 ${formatTime(prevEnd + constraints.activity.restIntervalMinutes)}`,
      });
    }
  }

  return issues;
}

function validateDining(plan: Plan, constraints: TravelConstraints): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const foodActivities = plan.activities.filter((a) => a.type === 'food');

  if (foodActivities.length === 0 && constraints.timeWindow.totalHours >= 4) {
    issues.push({
      id: 'no_food',
      severity: 'warning',
      category: 'dining',
      message: '行程超过 4 小时但没有安排餐饮',
      suggestion: '添加一个餐厅活动',
    });
  }

  // 检查餐饮类型
  if (constraints.dining.mealType === 'light') {
    for (const food of foodActivities) {
      const title = food.title.toLowerCase();
      const desc = (food.description || '').toLowerCase();
      const text = `${title} ${desc}`;

      if (/火锅|烧烤|自助|炸鸡|汉堡|薯条/.test(text)) {
        issues.push({
          id: `heavy_food_${food.id}`,
          severity: 'warning',
          category: 'dining',
          message: `"${food.title}" 不适合减肥/低卡需求`,
          activityId: food.id,
          suggestion: '替换为轻食/沙拉/低卡餐厅',
        });
      }
    }
  }

  // 检查饮食限制
  for (const restriction of constraints.dining.dietaryRestrictions) {
    for (const food of foodActivities) {
      const text = `${food.title} ${food.description || ''}`.toLowerCase();

      if (restriction === '不吃辣' && /辣|川菜|湘菜|麻辣/.test(text)) {
        issues.push({
          id: `spicy_${food.id}`,
          severity: 'error',
          category: 'dining',
          message: `"${food.title}" 包含辣味，不适合不吃辣的同行人`,
          activityId: food.id,
          suggestion: '替换为不辣的餐厅',
        });
      }

      if (restriction === '素食' && /烤肉|牛排|海鲜|烧烤/.test(text)) {
        issues.push({
          id: `meat_${food.id}`,
          severity: 'error',
          category: 'dining',
          message: `"${food.title}" 不适合素食者`,
          activityId: food.id,
          suggestion: '替换为素食餐厅',
        });
      }
    }
  }

  return issues;
}

const DRINKS_PATTERN =
  /咖啡|coffee|cafe|奶茶|茶饮|甜品|dessert|下午茶|饮品|果汁|星巴克|瑞幸|manner|喜茶|奈雪|茶百道|霸王茶姬|沪上阿姨/i;

function isDrinksActivity(activity: Activity): boolean {
  return (
    activity.type === 'food' &&
    DRINKS_PATTERN.test(`${activity.title} ${activity.description || ''}`)
  );
}

function validateDrinksFrequency(plan: Plan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const drinksActivities = plan.activities.filter(isDrinksActivity);

  if (drinksActivities.length >= 2) {
    issues.push({
      id: 'too_many_drinks',
      severity: 'warning',
      category: 'dining',
      message: `同一天安排了 ${drinksActivities.length} 次饮品活动（${drinksActivities.map((a) => a.title).join('、')}），建议每天最多 1 次`,
      suggestion: '将多余的饮品活动替换为正餐或景点',
    });
  }

  const foodActivities = plan.activities.filter((a) => a.type === 'food');
  const mealActivities = foodActivities.filter((a) => !isDrinksActivity(a));

  if (foodActivities.length >= 2 && mealActivities.length === 0) {
    issues.push({
      id: 'no_meal_only_drinks',
      severity: 'warning',
      category: 'dining',
      message: '所有餐饮活动都是咖啡/饮品，没有安排正餐',
      suggestion: '至少安排一顿正餐（午餐或晚餐）',
    });
  }

  return issues;
}

function validateChildFriendly(plan: Plan, constraints: TravelConstraints): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!constraints.travel.hasChildren) return issues;

  for (const activity of plan.activities) {
    const text = `${activity.title} ${activity.description || ''}`.toLowerCase();

    // 检查不适合儿童的场所
    if (/酒吧|夜店|ktv|网吧|密室逃脱|鬼屋/.test(text)) {
      issues.push({
        id: `not_child_friendly_${activity.id}`,
        severity: 'error',
        category: 'constraint',
        message: `"${activity.title}" 不适合儿童`,
        activityId: activity.id,
        suggestion: '替换为亲子友好的场所',
      });
    }

    // 检查需要大量步行的场所
    if (/爬山|徒步|长城|远足/.test(text)) {
      issues.push({
        id: `too_much_walking_${activity.id}`,
        severity: 'warning',
        category: 'constraint',
        message: `"${activity.title}" 需要大量步行，不适合 5 岁儿童`,
        activityId: activity.id,
        suggestion: '考虑替换为室内活动或缩短时长',
      });
    }
  }

  return issues;
}

function validateActivitySequence(plan: Plan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const types = plan.activities.map((a) => a.type);

  // 检查是否连续安排高强度活动
  let consecutiveHighIntensity = 0;
  for (const activity of plan.activities) {
    const text = `${activity.title} ${activity.description || ''}`.toLowerCase();
    const isHighIntensity = /游乐园|过山车|跳楼机|攀岩|滑雪|水上乐园/.test(text);

    if (isHighIntensity) {
      consecutiveHighIntensity++;
      if (consecutiveHighIntensity >= 2) {
        issues.push({
          id: `consecutive_high_${activity.id}`,
          severity: 'warning',
          category: 'activity',
          message: `连续安排了 ${consecutiveHighIntensity} 个高强度活动，建议中间插入休息`,
          activityId: activity.id,
          suggestion: '在高强度活动之间安排轻松的活动（如咖啡馆、散步）',
        });
      }
    } else {
      consecutiveHighIntensity = 0;
    }
  }

  // 检查活动顺序（建议：轻→重→餐→轻）
  const hasFood = types.includes('food');
  const hasActivity = types.includes('activity');

  if (hasFood && hasActivity) {
    const lastFoodIdx = types.lastIndexOf('food');
    const firstActivityIdx = types.indexOf('activity');

    // 如果餐饮在活动之前（除了午餐），可能不合理
    if (lastFoodIdx < firstActivityIdx && lastFoodIdx > 0) {
      issues.push({
        id: 'sequence_suggestion',
        severity: 'info',
        category: 'activity',
        message: '建议活动顺序：轻体力 → 中体力 → 餐饮 → 轻体力',
        suggestion: '考虑调整活动顺序以获得更好的体验',
      });
    }
  }

  return issues;
}

// ── 自动修正 ──

function autoFixTimeIssues(plan: Plan, issues: ValidationIssue[]): Plan {
  const fixedPlan = { ...plan, activities: [...plan.activities] };

  for (const issue of issues) {
    if (issue.severity !== 'warning' && issue.severity !== 'error') continue;
    if (!issue.activityId) continue;

    // 修正超时活动
    if (issue.id.startsWith('duration_exceed_')) {
      const idx = fixedPlan.activities.findIndex((a) => a.id === issue.activityId);
      if (idx >= 0) {
        const activity = fixedPlan.activities[idx];
        if (activity.timeLine) {
          const parts = activity.timeLine.split('-').map((s) => s.trim());
          const start = parseTime(parts[0]);
          const newEnd = start + 120; // 限制到 2 小时
          fixedPlan.activities[idx] = {
            ...activity,
            timeLine: `${parts[0]}-${formatTime(newEnd)}`,
          };
        }
      }
    }

    // 修正休息间隔不足
    if (issue.id.startsWith('rest_short_')) {
      const idx = fixedPlan.activities.findIndex((a) => a.id === issue.activityId);
      if (idx > 0) {
        const prev = fixedPlan.activities[idx - 1];
        const curr = fixedPlan.activities[idx];
        if (prev.timeLine && curr.timeLine) {
          const prevEnd = parseTime(prev.timeLine.split('-')[1].trim());
          const newStart = prevEnd + 15;
          const duration = parseActivityDuration(curr);
          fixedPlan.activities[idx] = {
            ...curr,
            timeLine: `${formatTime(newStart)}-${formatTime(newStart + duration)}`,
          };
        }
      }
    }
  }

  return fixedPlan;
}

// ── BudgetOptions 校验 ──

function extractBrand(name: string): string {
  const match = name.match(/^([^(（]+)/);
  return match ? match[1].trim() : name;
}

function validateBudgetOptions(plan: Plan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(plan.budgetOptions)) return issues;

  // 收集所有活动标题集合（主行程 + 各预算版本）
  const allTitleSets = [
    plan.activities.map((a) => a.title),
    ...plan.budgetOptions.map((opt) =>
      Array.isArray(opt.activities) ? opt.activities.map((a) => a.title) : []
    ),
  ];

  // 检查版本间活动重合度（更宽松的阈值）
  for (let i = 0; i < allTitleSets.length; i++) {
    for (let j = i + 1; j < allTitleSets.length; j++) {
      const setI = new Set(allTitleSets[i]);
      const setJ = new Set(allTitleSets[j]);
      const overlap = allTitleSets[j].filter((title) => setI.has(title)).length;
      const total = new Set([...allTitleSets[i], ...allTitleSets[j]]).size;

      // 只有当重合度超过80%才警告，且降级为info
      if (total > 0 && overlap / total > 0.8) {
        const labelI = i === 0 ? '主行程' : plan.budgetOptions[i - 1]?.label;
        const labelJ = j === 0 ? '主行程' : plan.budgetOptions[j - 1]?.label;

        issues.push({
          id: `budget_overlap_${i}_${j}`,
          severity: 'info',
          category: 'constraint',
          message: `${labelI}与${labelJ}活动重合度较高（${((overlap / total) * 100).toFixed(0)}%），建议增加差异`,
          suggestion: '可以保留核心推荐，替换1-2个活动以体现版本差异',
        });
      }
    }
  }

  const mainActivityTitles = new Set(plan.activities.map((a) => a.title));

  for (const option of plan.budgetOptions) {
    if (!Array.isArray(option.activities)) continue;

    const brandMap = new Map<string, string[]>();
    for (const act of option.activities) {
      const brand = extractBrand(act.title);
      if (brand.length >= 2) {
        const existing = brandMap.get(brand) || [];
        existing.push(act.title);
        brandMap.set(brand, existing);
      }
    }

    for (const [brand, titles] of brandMap) {
      if (titles.length >= 2) {
        issues.push({
          id: `budget_duplicate_brand_${option.label}`,
          severity: 'warning',
          category: 'distance',
          message: `${option.label}中出现了同品牌重复门店：${titles.join('、')}`,
          suggestion: `将其中一个${brand}替换为其他类型餐饮`,
        });
      }
    }

    const foodActivities = option.activities.filter((a) => a.type === 'food');
    const foodTitles = foodActivities.map((a) => a.title);
    if (foodTitles.length >= 2) {
      const allSimilar = foodActivities.every((a) => {
        const brand = extractBrand(a.title);
        return brand === extractBrand(foodTitles[0]);
      });
      if (allSimilar) {
        issues.push({
          id: `budget_similar_food_${option.label}`,
          severity: 'warning',
          category: 'dining',
          message: `${option.label}的餐饮类型过于单一：${foodTitles.join('、')}`,
          suggestion: '选择不同类型的餐饮以增加体验丰富度',
        });
      }
    }

    // 检查经济版是否有至少1个新活动
    if (option.label === '经济版') {
      const newActivities = option.activities.filter((a) => !mainActivityTitles.has(a.title));
      if (newActivities.length < 1) {
        issues.push({
          id: `budget_economy_no_new`,
          severity: 'warning',
          category: 'constraint',
          message: '经济版没有新增活动',
          suggestion: '经济版应至少包含1个主行程中没有的活动',
        });
      }
    }

    // 检查品质版是否有至少2个新活动
    if (option.label === '品质版') {
      const newActivities = option.activities.filter((a) => !mainActivityTitles.has(a.title));
      if (newActivities.length < 2) {
        issues.push({
          id: `budget_premium_no_new`,
          severity: 'warning',
          category: 'constraint',
          message: `品质版新增活动不足（当前${newActivities.length}个，建议至少2个）`,
          suggestion: '品质版应包含至少2个主行程中没有的活动',
        });
      }
    }
  }

  return issues;
}

function validateActivityCount(plan: Plan, constraints: TravelConstraints): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const count = plan.activities?.length || 0;
  const expected = constraints.activity.maxActivities;

  if (expected) {
    // 使用弹性范围而非硬性数量
    const minExpected = Math.max(1, expected - 1);
    const maxExpected = expected + 2;

    if (count < minExpected) {
      issues.push({
        id: 'activity_count_low',
        severity: 'warning',
        category: 'constraint',
        message: `活动数量偏少：建议 ${expected} 个，实际 ${count} 个`,
        suggestion: '考虑增加 1-2 个活动以充分利用时间',
      });
    } else if (count > maxExpected) {
      issues.push({
        id: 'activity_count_high',
        severity: 'warning',
        category: 'constraint',
        message: `活动数量偏多：建议 ${expected} 个，实际 ${count} 个`,
        suggestion: '考虑减少活动以避免行程过于紧凑',
      });
    }
  }

  // 检查约会场景的餐饮要求（建议性）
  if (constraints.intent === 'date' || constraints.dining.requireCafe) {
    const foodActivities = plan.activities.filter((a) => a.type === 'food');
    const hasCafe = foodActivities.some((a) =>
      DRINKS_PATTERN.test(`${a.title} ${a.description || ''}`)
    );

    if (constraints.dining.requireCafe && !hasCafe) {
      issues.push({
        id: 'date_no_cafe',
        severity: 'info',
        category: 'dining',
        message: '约会场景建议包含咖啡馆/下午茶，增加浪漫氛围',
        suggestion: '考虑增加一个咖啡馆或下午茶活动',
      });
    }

    // 检查约会场景是否全是餐饮（建议性）
    const nonFoodActivities = plan.activities.filter((a) => a.type !== 'food');
    if (foodActivities.length === count && count >= 3) {
      issues.push({
        id: 'date_all_food',
        severity: 'info',
        category: 'constraint',
        message: '约会场景全部安排了餐饮，建议穿插体验活动（如散步、展览、拍照点）',
        suggestion: '将 1 个餐饮替换为体验活动，增加约会丰富度',
      });
    }
  }

  return issues;
}

// ── 主函数 ──

/**
 * 验证行程是否满足约束条件
 */
export function validatePlan(
  plan: Plan,
  constraints: TravelConstraints,
  options?: {
    autoFix?: boolean;
    strictMode?: boolean;
  }
): ValidationResult {
  const { autoFix = true, strictMode = false } = options || {};

  // 收集所有问题
  const issues: ValidationIssue[] = [
    ...validateTimeWindow(plan, constraints),
    ...validateActivityDuration(plan, constraints),
    ...validateRestInterval(plan, constraints),
    ...validateDining(plan, constraints),
    ...validateDrinksFrequency(plan),
    ...validateChildFriendly(plan, constraints),
    ...validateActivitySequence(plan),
    ...validateBudgetOptions(plan),
    ...validateActivityCount(plan, constraints),
  ];

  // 计算分数
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 20;
    else if (issue.severity === 'warning') score -= 10;
    else if (issue.severity === 'info') score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  // 判断是否通过
  const hasErrors = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.filter((i) => i.severity === 'warning').length >= 3;
  const valid = strictMode ? issues.length === 0 : !hasErrors && !hasWarnings;

  // 生成摘要
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  let summary = '';
  if (valid) {
    summary = `行程验证通过（评分 ${score}/100）`;
    if (infoCount > 0) summary += `，有 ${infoCount} 条建议`;
  } else {
    summary = `行程需要调整（评分 ${score}/100）`;
    if (errorCount > 0) summary += `，${errorCount} 个严重问题`;
    if (warningCount > 0) summary += `，${warningCount} 个警告`;
  }

  // 自动修正
  let fixedPlan: Plan | undefined;
  if (autoFix && !valid) {
    fixedPlan = autoFixTimeIssues(plan, issues);
  }

  return {
    valid,
    score,
    issues,
    fixedPlan,
    summary,
  };
}

/**
 * 将验证结果转换为用户友好的提示
 */
export function validationToUserMessage(result: ValidationResult): string {
  if (result.valid) {
    return result.summary;
  }

  const lines: string[] = ['⚠️ 行程优化建议：'];

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');

  for (const issue of [...errors, ...warnings].slice(0, 5)) {
    lines.push(`• ${issue.message}`);
    if (issue.suggestion) {
      lines.push(`  → ${issue.suggestion}`);
    }
  }

  if (result.score < 60) {
    lines.push('\n💡 建议重新规划以获得更好的体验');
  }

  return lines.join('\n');
}
