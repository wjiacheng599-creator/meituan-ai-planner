/**
 * preCheck — 前端可用性预检适配器
 *
 * 下单前调用后端预检，失败时获取替代方案
 */

import type { FailureReason } from '../components/itinerary/BookingFailureDialog';
import { apiUrl } from "./apiBase";
import type { Activity } from './ai';

export interface PreCheckResult {
  available: boolean;
  failureType?: FailureReason;
  reason?: string;
  alternatives?: string[];
  suggestion?: string;
}

/**
 * 对单个活动进行预订前预检
 * 调用 POST /api/availability/check
 */
export async function preCheckActivity(
  activity: Activity,
  memberCount?: number
): Promise<PreCheckResult> {
  try {
    const response = await fetch(apiUrl('/api/availability/check'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: activity.id,
        activityTitle: activity.title,
        activityType: activity.type,
        timeLine: activity.timeLine,
        memberCount: memberCount || 2,
        price: activity.price,
      }),
    });

    if (!response.ok) {
      console.warn('[PreCheck] API error, falling back to available');
      return { available: true };
    }

    const data = await response.json();
    return {
      available: data.available,
      failureType: data.failureType,
      reason: data.reason,
      alternatives: data.alternatives,
      suggestion: data.suggestion,
    };
  } catch (err) {
    // 预检失败不影响正常流程 — 默认可用
    console.warn('[PreCheck] Network error, assuming available:', err);
    return { available: true };
  }
}

/**
 * 批量预检多个活动
 * 返回每个活动的预检结果
 */
export async function batchPreCheck(
  activities: Activity[],
  memberCount?: number
): Promise<Map<string, PreCheckResult>> {
  const results = new Map<string, PreCheckResult>();

  // 并行预检所有活动（最多 5 个并发）
  const chunks: Activity[][] = [];
  for (let i = 0; i < activities.length; i += 5) {
    chunks.push(activities.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map((act) => preCheckActivity(act, memberCount)));
    chunk.forEach((act, i) => results.set(act.id, chunkResults[i]));
  }

  return results;
}

/**
 * 根据失败原因获取替代方案文案
 */
export function getFailureAlternatives(activity: Activity, reason: FailureReason): string[] {
  switch (reason) {
    case 'no_seat':
      return [
        `附近同类餐厅（距${activity.title}步行5分钟）`,
        `换个时段（14:00-16:00 空闲位多）`,
        `外卖/打包带走（无需等位）`,
      ];
    case 'no_ticket':
      return [
        `同类型替代景点（保留核心体验）`,
        `附近免费景点（同样值得游览）`,
        `换个日期或选择冷门时段`,
      ];
    case 'time_conflict':
      return [`延后30分钟（避开冲突时段）`, `替换为附近半小时可达场所`, `压缩前序活动10-15分钟`];
    case 'merchant_unavailable':
      return [`附近同类型商家`, `选择外卖配送`, `跳过此活动继续行程`];
    case 'capacity_exceeded':
      return [`分两批就餐`, `选择面积更大的同类餐厅`, `外卖到公园野餐`];
    default:
      return [`重试预订`, `跳过此活动`, `联系商家确认`];
  }
}
