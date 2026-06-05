import { apiUrl } from "../services/apiBase";
/**
 * useBehaviorTracking - 用户行为事件采集 hook
 *
 * 记录用户在应用中的关键行为，用于个性化推荐。
 * 事件通过 fire-and-forget 方式异步上报，不阻塞用户操作。
 */

import { useCallback, useRef } from 'react';

export type BehaviorEventType =
  | 'select' // 选择活动
  | 'skip' // 跳过活动
  | 'complete' // 完成活动
  | 'cancel' // 取消预订
  | 'vote' // 投票
  | 'search' // 搜索查询
  | 'share'; // 分享行程

interface BehaviorEventMetadata {
  activityTitle?: string;
  activityType?: string; // food/activity/travel
  tags?: string[];
  price?: number;
  city?: string;
  voteType?: 'approve' | 'reject' | 'suggest';
  searchQuery?: string;
  [key: string]: unknown;
}

export function useBehaviorTracking() {
  // 防抖：同一事件短时间内不重复上报
  const recentEventsRef = useRef<Map<string, number>>(new Map());

  const trackEvent = useCallback(
    (
      type: BehaviorEventType,
      options?: {
        planId?: string;
        activityId?: string;
        metadata?: BehaviorEventMetadata;
      }
    ) => {
      // 生成去重 key
      const dedupeKey = `${type}_${options?.planId || ''}_${options?.activityId || ''}`;
      const now = Date.now();
      const lastTime = recentEventsRef.current.get(dedupeKey);

      // 5 秒内相同事件不上报
      if (lastTime && now - lastTime < 5000) return;
      recentEventsRef.current.set(dedupeKey, now);

      // 清理过期的去重记录（防止内存泄漏）
      if (recentEventsRef.current.size > 100) {
        for (const [key, time] of recentEventsRef.current.entries()) {
          if (now - time > 30000) recentEventsRef.current.delete(key);
        }
      }

      // fire-and-forget 上报
      fetch(apiUrl('/api/behavior/track'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          planId: options?.planId,
          activityId: options?.activityId,
          metadata: options?.metadata || {},
        }),
      }).catch(() => {
        /* silent */
      });
    },
    []
  );

  // 便捷方法
  const trackSelect = useCallback(
    (planId: string, activityId: string, metadata?: BehaviorEventMetadata) => {
      trackEvent('select', { planId, activityId, metadata });
    },
    [trackEvent]
  );

  const trackSkip = useCallback(
    (planId: string, activityId: string, metadata?: BehaviorEventMetadata) => {
      trackEvent('skip', { planId, activityId, metadata });
    },
    [trackEvent]
  );

  const trackComplete = useCallback(
    (planId: string, activityId: string, metadata?: BehaviorEventMetadata) => {
      trackEvent('complete', { planId, activityId, metadata });
    },
    [trackEvent]
  );

  const trackCancel = useCallback(
    (planId: string, activityId: string, metadata?: BehaviorEventMetadata) => {
      trackEvent('cancel', { planId, activityId, metadata });
    },
    [trackEvent]
  );

  const trackVote = useCallback(
    (
      planId: string,
      voteType: 'approve' | 'reject' | 'suggest',
      metadata?: BehaviorEventMetadata
    ) => {
      trackEvent('vote', { planId, metadata: { ...metadata, voteType } });
    },
    [trackEvent]
  );

  const trackSearch = useCallback(
    (searchQuery: string, metadata?: BehaviorEventMetadata) => {
      trackEvent('search', { metadata: { ...metadata, searchQuery } });
    },
    [trackEvent]
  );

  const trackShare = useCallback(
    (planId: string, metadata?: BehaviorEventMetadata) => {
      trackEvent('share', { planId, metadata });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackSelect,
    trackSkip,
    trackComplete,
    trackCancel,
    trackVote,
    trackSearch,
    trackShare,
  };
}
