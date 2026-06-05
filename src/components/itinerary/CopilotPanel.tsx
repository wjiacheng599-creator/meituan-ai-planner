import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Plan, Activity, CopilotMessage } from '../../services/ai';
import { chatWithCopilot, generateAlternatives } from '../../services/ai';
import { checkTripHealth, type TripAlert } from '../../services/ai/selfHealing';
import { runGuardrails } from '../../services/ai/guardrails';
import { memoryIndex } from '../../services/ai/memoryIndex';
import { generateTravelDNA } from '../../services/ai/travelDNA';
import type { PersonProfile } from '../../types';
import { loadCopilotChat, saveCopilotChat } from '../../services/storage';
import {
  Send,
  Mic,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Zap,
  Wand2,
  Soup,
  CloudSun,
  ArrowRightLeft,
  Banknote,
  Users,
  Clock,
  MapPin,
  Utensils,
  PlusCircle,
  Star,
} from 'lucide-react';
import InteractiveComponent, { type InteractiveComponentProps } from './InteractiveComponent';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';

interface CopilotChangeSummary {
  changedCount: number;
  budgetDelta: number;
  replacements: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
  movedTitles: string[];
}

function safeStr(val: unknown, fallback: string = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.name === 'string') return obj.name;
    return fallback;
  }
  return fallback;
}

function convertLegacyInteractiveComponent(
  legacy: any | undefined,
  callbacks: {
    onBudgetConfirm: (value: number) => void;
    onVoteConfirm: (selectedIds: string[]) => void;
    onTimeConfirm: (activityId: string, newTime: string) => void;
    onReplaceConfirm: (originalActivity: string, selected: any) => void;
    onAddConfirm: (selected: any[]) => void;
    onDismiss: () => void;
  }
): InteractiveComponentProps | null {
  if (!legacy || typeof legacy !== 'object') return null;

  // 支持两种格式：一种是 { type, props }，一种是直接是 props 对象包含 type
  const data = 'props' in legacy ? { ...legacy.props, type: legacy.type } : legacy;
  const type = data.type as string;

  try {
    switch (type) {
      case 'BudgetSlider':
        return {
          type: 'BudgetSlider',
          min: (data.min as number) ?? 100,
          max: (data.max as number) ?? 500,
          step: (data.step as number) ?? 50,
          currentValue: (data.currentValue as number) ?? 0,
          label: safeStr(data.label, '调整预算'),
          onConfirm: callbacks.onBudgetConfirm,
          onCancel: callbacks.onDismiss,
        };
      case 'OptionVoting':
        return {
          type: 'OptionVoting',
          title: safeStr(data.title, '选择偏好'),
          options:
            (data.options as Array<{ id: string; label: string; description?: string }>) ?? [],
          maxSelections: (data.maxSelections as number) ?? 2,
          onVote: callbacks.onVoteConfirm,
        };
      case 'TimeAdjuster':
        return {
          type: 'TimeAdjuster',
          activityId: safeStr(data.activityId, ''),
          currentTime: safeStr(data.currentTime, '12:00'),
          minTime: safeStr(data.minTime, '06:00'),
          maxTime: safeStr(data.maxTime, '22:00'),
          label: safeStr(data.label, ''),
          onConfirm: callbacks.onTimeConfirm,
          onCancel: callbacks.onDismiss,
        };
      case 'ActivityReplace':
        return {
          type: 'ActivityReplace',
          title: safeStr(data.title, '推荐替换'),
          originalActivity: safeStr(data.originalActivity, ''),
          options: Array.isArray(data.options)
            ? (data.options as any[]).map((opt: any) => ({
                id:
                  typeof opt?.id === 'string'
                    ? opt.id
                    : `opt_${Math.random().toString(36).substring(7)}`,
                title: safeStr(opt?.title, '推荐选项'),
                type: safeStr(opt?.type, 'activity'),
                price: typeof opt?.price === 'number' ? opt.price : 0,
                description: safeStr(opt?.description, ''),
                reason: safeStr(opt?.reason, ''),
                timeLine: typeof opt?.timeLine === 'string' ? opt.timeLine : undefined,
                tags: Array.isArray(opt?.tags) ? opt.tags : undefined,
              }))
            : [],
          onConfirm: callbacks.onReplaceConfirm,
          onCancel: callbacks.onDismiss,
        };
      case 'ActivityAdd':
        return {
          type: 'ActivityAdd',
          title: safeStr(data.title, '推荐增加'),
          options: Array.isArray(data.options)
            ? (data.options as any[]).map((opt: any) => ({
                id:
                  typeof opt?.id === 'string'
                    ? opt.id
                    : `opt_${Math.random().toString(36).substring(7)}`,
                title: safeStr(opt?.title, '推荐选项'),
                type: safeStr(opt?.type, 'activity'),
                price: typeof opt?.price === 'number' ? opt.price : 0,
                description: safeStr(opt?.description, ''),
                reason: safeStr(opt?.reason, ''),
                insertAfter: typeof opt?.insertAfter === 'string' ? opt.insertAfter : undefined,
                timeLine: typeof opt?.timeLine === 'string' ? opt.timeLine : undefined,
                tags: Array.isArray(opt?.tags) ? opt.tags : undefined,
              }))
            : [],
          onConfirm: callbacks.onAddConfirm,
          onCancel: callbacks.onDismiss,
        };
      default:
        return null;
    }
  } catch (e) {
    console.warn('Failed to convert interactive component:', e);
    return null;
  }
}

function getReadinessMeta(readiness?: Plan['executionReadiness']) {
  if (!readiness) {
    return {
      tone: 'idle' as const,
      title: '还没拿到执行状态',
      summary: '先看看路线，再决定要不要调整。',
      primaryLabel: '看看路线',
    };
  }

  if (readiness.status === 'ready') {
    return {
      tone: 'ready' as const,
      title: '这条路线可以直接执行',
      summary: readiness.summary,
      primaryLabel: '直接执行',
    };
  }

  if (readiness.status === 'adjust') {
    return {
      tone: 'warning' as const,
      title: '建议先微调 1 项',
      summary: readiness.summary,
      primaryLabel: '先微调',
    };
  }

  return {
    tone: 'risk' as const,
    title: '当前路线有明显风险',
    summary: readiness.summary,
    primaryLabel: '切换稳妥方案',
  };
}

function summarizeChangeReason(previous: Activity, next: Activity): string {
  if (next.price < previous.price) return '预算更稳';
  if (next.type !== previous.type) return '补齐路线节奏';
  if ((next.distanceInfo || '').includes('近') || (next.distanceInfo || '').includes('0.'))
    return '更顺路';
  if ((next.tags || []).some((tag) => /室内|天气/.test(tag))) return '更适合当前天气';
  return '更适合继续执行';
}

function buildCopilotChangeSummary(previous: Activity[], next: Activity[]): CopilotChangeSummary {
  const previousMap = new Map(previous.map((activity) => [activity.id, activity]));
  const previousOrder = previous.map((activity) => activity.id);
  const nextOrder = next.map((activity) => activity.id);
  const replacements = next.reduce<CopilotChangeSummary['replacements']>((acc, item) => {
    const before = previousMap.get(item.id);
    if (!before) return acc;
    const titleChanged = before.title !== item.title;
    const priceChanged = before.price !== item.price;
    const descChanged = before.description !== item.description;
    if (!titleChanged && !priceChanged && !descChanged) return acc;
    acc.push({
      from: before.title,
      to: item.title,
      reason: summarizeChangeReason(before, item),
    });
    return acc;
  }, []);

  const movedTitles = next
    .filter(
      (item, index) => previousOrder.indexOf(item.id) !== index && nextOrder.includes(item.id)
    )
    .map((item) => item.title);

  const previousBudget = previous.reduce((sum, item) => sum + item.price, 0);
  const nextBudget = next.reduce((sum, item) => sum + item.price, 0);

  return {
    changedCount: replacements.length + movedTitles.length,
    budgetDelta: nextBudget - previousBudget,
    replacements,
    movedTitles,
  };
}

export interface CopilotPanelProps {
  plan: Plan | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePlan?: (plan: Plan) => void;
  onStartCollaboration?: () => void;
  shareSlug?: string;
  readiness?: Plan['executionReadiness'];
  selectedActivities: Activity[];
  isExecuting: boolean;
  profiles: PersonProfile[];
  onExecute: () => void;
  initialMessage?: string;
}

export default memo(function CopilotPanel({
  plan,
  isOpen,
  onClose,
  onUpdatePlan,
  onStartCollaboration,
  shareSlug,
  readiness,
  selectedActivities,
  isExecuting,
  profiles,
  onExecute,
  initialMessage,
}: CopilotPanelProps) {
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotChangeSummary, setCopilotChangeSummary] = useState<CopilotChangeSummary | null>(
    null
  );
  const [isApplyingFallback, setIsApplyingFallback] = useState(false);
  const [interactiveComponent, setInteractiveComponent] =
    useState<InteractiveComponentProps | null>(null);
  const [tripAlerts, setTripAlerts] = useState<TripAlert[]>([]);
  const [favoritePrompts, setFavoritePrompts] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('copilot_favorites') || '[]');
    } catch {
      return [];
    }
  });
  // 新状态：跟踪是否是快捷按钮触发的交互
  const [isQuickActionMode, setIsQuickActionMode] = useState(false);
  const mountedRef = useRef(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copilotMessagesRef = useRef<CopilotMessage[]>([]);

  // 保持 ref 与 state 同步
  useEffect(() => {
    copilotMessagesRef.current = copilotMessages;
  }, [copilotMessages]);

  const teamProfilesStr =
    profiles.length > 0
      ? profiles
          .map(
            (p) =>
              `${p.name}(${p.relation}, ${p.ageGroup}, 偏好:${p.travelPreferences.join(',')}, 饮食:${p.dietaryPreferences.join(',')})`
          )
          .join('; ')
      : '';

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 加载聊天记录（清理旧数据中的对象型content）
  useEffect(() => {
    if (plan?.id) {
      const savedMessages = loadCopilotChat(plan.id);
      if (savedMessages.length > 0) {
        const clean = savedMessages.map((m) => {
          let content = '';
          try {
            if (typeof m.content === 'string') {
              content = m.content;
            } else if (typeof m.content === 'object' && m.content !== null) {
              const contentObj = m.content as Record<string, unknown>;
              if (contentObj.title && typeof contentObj.title === 'string') {
                content = contentObj.title;
              } else if (contentObj.message && typeof contentObj.message === 'string') {
                content = contentObj.message;
              } else {
                content = '聊天记录';
              }
            } else if (m.content) {
              content = String(m.content);
            } else {
              content = '';
            }
          } catch {
            content = '聊天记录';
          }
          return {
            ...m,
            content,
          };
        });
        setCopilotMessages(clean);
      } else {
        setCopilotMessages([]);
      }
    }
  }, [plan?.id]);

  // 自动运行行程健康检查（自愈策略）— 不依赖 isOpen，plan 加载即触发
  useEffect(() => {
    if (!plan) return;
    checkTripHealth(plan)
      .then((health) => {
        if (mountedRef.current) {
          setTripAlerts(health.alerts.filter((a) => a.severity !== 'info').slice(0, 3));
        }
      })
      .catch(() => {});
  }, [plan?.id]);

  // 协作投票轮询（每30秒检查是否有新投票）
  const [collabVoteSummary, setCollabVoteSummary] = useState<{
    total: number;
    consensus: string;
  } | null>(null);
  useEffect(() => {
    if (!isOpen || !shareSlug) return;
    const fetchVotes = async () => {
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(shareSlug)}/votes`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary?.total > 0) {
            setCollabVoteSummary(data.summary);
          }
        }
      } catch {}
    };
    fetchVotes();
    const interval = setInterval(fetchVotes, 30000);
    return () => clearInterval(interval);
  }, [isOpen, shareSlug]);

  // 保存聊天记录（防抖）
  useEffect(() => {
    if (plan?.id && copilotMessages.length > 0) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        // 确保保存时所有消息的content都是字符串
        const safeMessages = copilotMessages.map((m) => ({
          ...m,
          content: typeof m.content === 'string' ? m.content : '消息记录',
        }));
        saveCopilotChat(plan.id, safeMessages);
      }, 500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [copilotMessages, plan?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  const readinessMeta = useMemo(() => getReadinessMeta(readiness), [readiness]);

  const warningChecks = useMemo(
    () => readiness?.checks.filter((check) => check.status !== 'ok') || [],
    [readiness]
  );

  // 构建带行程上下文的快捷 prompt
  const buildQuickPrompt = useCallback(
    (action: string) => {
      if (!plan) return action;
      const actNames = plan.activities
        .slice(0, 4)
        .map((a) => a.title)
        .join('、');
      const ctx = `当前行程「${plan.title}」包含：${actNames}，总价¥${plan.totalPrice || 0}，${profiles.length || 1}人出行。`;
      return `${ctx}${action}`;
    },
    [plan, profiles.length]
  );

  // 用 ref 打破循环依赖，确保回调始终调用最新版本的 handleCopilotSend
  const handleCopilotSendRef = useRef<((text?: string) => Promise<void>) | null>(null);

  // 所有处理函数放在前面定义，避免初始化顺序问题
  const handleBudgetConfirm = useCallback(
    (value: number) => {
      if (!plan || !onUpdatePlan) return;
      setInteractiveComponent(null);
      setIsQuickActionMode(false);
      void handleCopilotSendRef.current?.(
        `我想把这次行程的总预算控制在 ¥${value} 以内，请帮我重新规划，替换或调整超出预算的活动`
      );
    },
    [plan, onUpdatePlan]
  );

  const handleVoteConfirm = useCallback(
    (selectedIds: string[]) => {
      if (!plan || !onUpdatePlan) return;
      setInteractiveComponent(null);
      setIsQuickActionMode(false);
      const selectedNames = selectedIds
        .map((id) => plan.activities.find((a) => a.id === id)?.title)
        .filter(Boolean)
        .join('、');
      void handleCopilotSendRef.current?.(
        `用户选择了这些活动：${selectedNames}。请帮我根据用户偏好重新调整行程，确保优先保留这些活动`
      );
    },
    [plan, onUpdatePlan]
  );

  const handleTimeConfirm = useCallback(
    (activityId: string, newTime: string) => {
      if (!plan || !onUpdatePlan) return;
      setInteractiveComponent(null);
      setIsQuickActionMode(false);
      const activity = plan.activities.find((a) => a.id === activityId);
      const activityName = activity?.title || '这个活动';
      const [hours, minutes] = newTime.split(':').map(Number);
      const period = hours < 12 ? '上午' : hours < 18 ? '下午' : '晚上';
      void handleCopilotSendRef.current?.(
        `我想把「${activityName}」调整到 ${period}${hours % 12 || 12}:${String(minutes).padStart(2, '0')}，请帮我重新计算这个活动及后续活动的时间，确保行程连贯合理`
      );
    },
    [plan, onUpdatePlan]
  );

  const handleReplaceConfirm = useCallback(
    (originalActivity: string, selected: any) => {
      if (!plan || !onUpdatePlan) return;
      setInteractiveComponent(null);
      setIsQuickActionMode(false);

      const applyReplace = (activities: Activity[] | undefined) => {
        if (!activities) return undefined;
        return activities.map((act) => {
          if (act.title === originalActivity) {
            return {
              ...act,
              ...selected,
              id: act.id,
              timeLine: selected.timeLine || act.timeLine,
            };
          }
          return act;
        });
      };

      const newActivities = applyReplace(plan.activities) || plan.activities;
      const totalPrice = newActivities.reduce((sum, a) => sum + (a.price || 0), 0);

      const newBudgetOptions = plan.budgetOptions?.map((option) => {
        const optionActivities = applyReplace(option.activities);
        const optionTotal = optionActivities
          ? optionActivities.reduce((sum, a) => sum + (a.price || 0), 0)
          : option.total;
        return { ...option, activities: optionActivities || option.activities, total: optionTotal };
      });

      onUpdatePlan({
        ...plan,
        activities: newActivities,
        totalPrice,
        budgetOptions: newBudgetOptions || plan.budgetOptions,
      });

      // 显示修改总结
      const summary = buildCopilotChangeSummary(plan.activities, newActivities);
      setCopilotChangeSummary(summary);

      // 添加确认消息
      setCopilotMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `已帮你把「${originalActivity}」替换为「${selected.title}」，调整了预算并保持行程节奏。`,
          suggestedActions: ['继续执行', '再换一个'],
        },
      ]);
    },
    [plan, onUpdatePlan]
  );

  const handleAddConfirm = useCallback(
    (selected: any[]) => {
      if (!plan || !onUpdatePlan) return;
      setInteractiveComponent(null);
      setIsQuickActionMode(false);

      if (selected.length > 0) {
        const newActivity = selected[0];
        const newId = `act_${Date.now()}`;
        const newActivities = [
          ...plan.activities,
          {
            ...newActivity,
            id: newId,
            tags: newActivity.tags || [],
          },
        ];

        const totalPrice = newActivities.reduce((sum, a) => sum + (a.price || 0), 0);
        const newBudgetOptions = plan.budgetOptions?.map((option) => {
          const optionActivities = option.activities
            ? [
                ...option.activities,
                {
                  ...newActivity,
                  id: newId,
                  tags: newActivity.tags || [],
                },
              ]
            : option.activities;
          const optionTotal = optionActivities
            ? optionActivities.reduce((sum, a) => sum + (a.price || 0), 0)
            : option.total;
          return { ...option, activities: optionActivities, total: optionTotal };
        });
        onUpdatePlan({
          ...plan,
          activities: newActivities,
          totalPrice,
          budgetOptions: newBudgetOptions || plan.budgetOptions,
        });

        // 显示修改总结
        const summary = buildCopilotChangeSummary(plan.activities, newActivities);
        setCopilotChangeSummary(summary);

        // 添加确认消息
        setCopilotMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `已帮你在行程中添加了「${newActivity.title}」，行程更丰富了！`,
            suggestedActions: ['继续执行', '再调整'],
          },
        ]);
      }
    },
    [plan, onUpdatePlan]
  );

  const handleDismissInteractive = useCallback(() => {
    setInteractiveComponent(null);
    setIsQuickActionMode(false);
  }, []);

  const handleSaveFavorite = useCallback(() => {
    const text = copilotInput.trim();
    if (!text || favoritePrompts.includes(text)) return;
    const next = [text, ...favoritePrompts].slice(0, 5);
    setFavoritePrompts(next);
    localStorage.setItem('copilot_favorites', JSON.stringify(next));
    setCopilotInput('');
  }, [copilotInput, favoritePrompts]);

  const handleRemoveFavorite = useCallback(
    (prompt: string) => {
      const next = favoritePrompts.filter((p) => p !== prompt);
      setFavoritePrompts(next);
      localStorage.setItem('copilot_favorites', JSON.stringify(next));
    },
    [favoritePrompts]
  );

  const handleFallbackApply = useCallback(
    async (fallbackLabel: string) => {
      if (!plan || !onUpdatePlan || isApplyingFallback) return;

      let target: Activity | undefined;

      if (fallbackLabel.includes('餐厅')) {
        target = plan.activities.find((activity) => activity.type === 'food');
      } else if (fallbackLabel.includes('天气')) {
        target = plan.activities.find((activity) => activity.type === 'activity');
      } else if (fallbackLabel.includes('排队')) {
        target =
          plan.activities.find((activity) => activity.type === 'food') ||
          plan.activities.find((activity) => activity.type === 'activity');
      }

      if (!target) return;

      setIsApplyingFallback(true);
      try {
        const alternatives = await generateAlternatives(target, fallbackLabel);
        if (!mountedRef.current) return;
        const replacement = alternatives[0];
        if (!replacement) return;
        const newPlanActivities = plan.activities.map((activity) =>
          activity.id === target!.id
            ? {
                ...replacement,
                id: target!.id,
                timeLine: target!.timeLine,
              }
            : activity
        );
        const planTotal = plan.activities.reduce(
          (sum, activity) =>
            sum + (activity.id === target!.id ? replacement.price : activity.price),
          0
        );
        const newBudgetOptions = plan.budgetOptions?.map((option) => {
          if (!option.activities) return option;
          const optionActivities = option.activities.map((activity) =>
            activity.id === target!.id
              ? {
                  ...replacement,
                  id: target!.id,
                  timeLine: target!.timeLine,
                }
              : activity
          );
          const optionTotal = optionActivities.reduce((sum, a) => sum + (a.price || 0), 0);
          return { ...option, activities: optionActivities, total: optionTotal };
        });
        onUpdatePlan({
          ...plan,
          activities: newPlanActivities,
          totalPrice: planTotal,
          budgetOptions: newBudgetOptions || plan.budgetOptions,
        });
        setCopilotMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `我已经按"${fallbackLabel}"帮你换成更稳妥的选择：${replacement.title}。`,
            suggestedActions: ['继续执行', '再换一个', '优化顺序'],
          },
        ]);
      } finally {
        setIsApplyingFallback(false);
      }
    },
    [plan, onUpdatePlan, isApplyingFallback]
  );

  // 快捷按钮处理函数
  const handleQuickAction = useCallback(
    async (
      actionType:
        | 'replaceScenic'
        | 'replaceRestaurant'
        | 'adjustTime'
        | 'addActivity'
        | 'adjustBudget'
    ) => {
      if (!plan || copilotLoading) return;

      setIsQuickActionMode(true);
      setCopilotChangeSummary(null);
      setInteractiveComponent(null);

      // 1. 先发送消息给 AI
      let message = '';
      switch (actionType) {
        case 'replaceScenic':
          message = buildQuickPrompt('帮我替换一个景点，推荐同类型的替代选择，考虑出行成员的偏好');
          break;
        case 'replaceRestaurant':
          message = buildQuickPrompt('帮我换一家餐厅，保持相同风格和价位，考虑出行成员的饮食偏好');
          break;
        case 'adjustTime':
          message = buildQuickPrompt('帮我检查行程时间是否合理，调整过于紧凑的活动');
          break;
        case 'addActivity':
          message = buildQuickPrompt('帮我在行程中增加一个活动，保持节奏合理，考虑出行成员的兴趣');
          break;
        case 'adjustBudget':
          message = buildQuickPrompt('帮我看看哪里可以优化预算，控制总花费');
          break;
      }

      const userMsg: CopilotMessage = { role: 'user', content: message };
      setCopilotMessages((prev) => [...prev, userMsg]);
      setCopilotLoading(true);

      try {
        const context = {
          planTitle: plan.title || '未知行程',
          activities: plan.activities.map((a) => a.title) || [],
          teamProfiles: teamProfilesStr || undefined,
          strategy: plan?.strategy || undefined,
          currentActivities: plan.activities || undefined,
        };
        const reply = await chatWithCopilot(message, context, copilotMessagesRef.current, plan.id);
        if (!mountedRef.current) return;

        setCopilotMessages((prev) => [
          ...prev,
          {
            ...reply,
            content:
              typeof reply.content === 'string' ? reply.content : String(reply.content || ''),
          },
        ]);

        // 2. 优先使用 AI 返回的卡片
        if (reply.interactiveComponent) {
          const converted = convertLegacyInteractiveComponent(reply.interactiveComponent, {
            onBudgetConfirm: handleBudgetConfirm,
            onVoteConfirm: handleVoteConfirm,
            onTimeConfirm: handleTimeConfirm,
            onReplaceConfirm: handleReplaceConfirm,
            onAddConfirm: handleAddConfirm,
            onDismiss: handleDismissInteractive,
          });
          if (converted) {
            setInteractiveComponent(converted);
            return;
          }
        }

        // 3. 如果 AI 没有返回卡片，我们自己生成一个
        if (actionType === 'adjustBudget') {
          const totalBudget = plan.activities.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
          setInteractiveComponent({
            type: 'BudgetSlider',
            min: 100,
            max: Math.max(500, totalBudget * 2),
            step: 50,
            currentValue: totalBudget,
            label: '调整预算',
            onConfirm: handleBudgetConfirm,
            onCancel: handleDismissInteractive,
          });
        } else if (actionType === 'replaceScenic' || actionType === 'replaceRestaurant') {
          const isFoodReplace = actionType === 'replaceRestaurant';
          const activityToReplace = isFoodReplace
            ? plan.activities.find((a) => a.type === 'food')
            : plan.activities.find((a) => a.type !== 'food');

          if (activityToReplace) {
            const alternatives = await generateAlternatives(
              activityToReplace,
              isFoodReplace ? '同类型推荐' : '推荐同类型替代'
            );

            if (alternatives.length > 0) {
              const options = alternatives.map((alt, idx) => ({
                ...alt, // 保留所有原始数据（包括图片、店名等）
                id: alt.id || `opt_${idx}`,
                title: alt.title,
                type: alt.type,
                price: alt.price,
                description: alt.description,
                reason: alt.tags && alt.tags.length > 0 ? alt.tags[0] : '推荐选择',
                timeLine: activityToReplace.timeLine,
                tags: alt.tags,
              }));

              setInteractiveComponent({
                type: 'ActivityReplace',
                title: isFoodReplace ? '推荐餐厅' : '推荐替换',
                originalActivity: activityToReplace.title,
                options: options,
                onConfirm: handleReplaceConfirm,
                onCancel: handleDismissInteractive,
              });
            }
          }
        } else if (actionType === 'adjustTime') {
          const firstActivity = plan.activities[0];
          if (firstActivity) {
            const startTime = firstActivity.timeLine?.split('-')[0] || '12:00';
            setInteractiveComponent({
              type: 'TimeAdjuster',
              activityId: firstActivity.id,
              currentTime: startTime,
              minTime: '06:00',
              maxTime: '22:00',
              label: firstActivity.title,
              onConfirm: handleTimeConfirm,
              onCancel: handleDismissInteractive,
            });
          }
        } else if (actionType === 'addActivity') {
          const lastActivity = plan.activities[plan.activities.length - 1];
          const addOptions = [
            {
              id: 'opt_1',
              title: '放松休息',
              type: 'activity',
              price: 50,
              description: '让行程更舒适，避免过度疲劳',
              reason: '劳逸结合',
              insertAfter: lastActivity?.title,
            },
            {
              id: 'opt_2',
              title: '特色体验',
              type: 'activity',
              price: 100,
              description: '深入了解当地文化',
              reason: '独特体验',
            },
          ];

          setInteractiveComponent({
            type: 'ActivityAdd',
            title: '推荐添加',
            options: addOptions,
            onConfirm: handleAddConfirm,
            onCancel: handleDismissInteractive,
          });
        }
      } catch (error) {
        console.error('Copilot error:', error);
        setCopilotMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '抱歉，我现在暂时无法回复，请稍后再试。',
            suggestedActions: [],
          },
        ]);
      } finally {
        setCopilotLoading(false);
      }
    },
    [
      plan,
      copilotLoading,
      buildQuickPrompt,
      teamProfilesStr,
      handleBudgetConfirm,
      handleVoteConfirm,
      handleTimeConfirm,
      handleReplaceConfirm,
      handleAddConfirm,
      handleDismissInteractive,
    ]
  );

  const handleCopilotSend = useCallback(
    async (text?: string) => {
      const message = text || copilotInput.trim();
      if (!message || copilotLoading) return;

      setCopilotInput('');
      setCopilotChangeSummary(null);
      setIsQuickActionMode(false);
      const userMsg: CopilotMessage = { role: 'user', content: message };
      setCopilotMessages((prev) => [...prev, userMsg]);
      setCopilotLoading(true);

      try {
        const context = {
          planTitle: plan?.title || '未知行程',
          activities: plan?.activities?.map((a) => a.title) || [],
          teamProfiles: teamProfilesStr || undefined,
          strategy: plan?.strategy || undefined,
          currentActivities: plan?.activities || undefined,
        };
        const reply = await chatWithCopilot(message, context, copilotMessagesRef.current, plan?.id);
        if (!mountedRef.current) return;
        setCopilotMessages((prev) => [
          ...prev,
          {
            ...reply,
            content:
              typeof reply.content === 'string' ? reply.content : String(reply.content || ''),
          },
        ]);

        // 普通对话模式：只有AI返回卡片才显示
        if (reply.interactiveComponent) {
          const converted = convertLegacyInteractiveComponent(reply.interactiveComponent, {
            onBudgetConfirm: handleBudgetConfirm,
            onVoteConfirm: handleVoteConfirm,
            onTimeConfirm: handleTimeConfirm,
            onReplaceConfirm: handleReplaceConfirm,
            onAddConfirm: handleAddConfirm,
            onDismiss: handleDismissInteractive,
          });
          if (converted) {
            setInteractiveComponent(converted);
          }
        } else if (
          reply.modifiedActivities &&
          reply.modifiedActivities.length > 0 &&
          plan &&
          onUpdatePlan
        ) {
          // 无交互卡片时，直接应用修改
          const safeModifiedActivities = reply.modifiedActivities
            .filter((a: any) => a && typeof a === 'object' && a.type !== 'travel')
            .map((a: any, i: number) => ({
              ...a, // 保留所有原始字段，包括图片和店名等
              id: typeof a?.id === 'string' ? a.id : `act_${Date.now()}_${i}`,
              timeLine: typeof a?.timeLine === 'string' ? a.timeLine : '待定',
              title: typeof a?.title === 'string' ? a.title : '未命名',
              type: typeof a?.type === 'string' ? a.type : 'activity',
              description: typeof a?.description === 'string' ? a.description : '',
              price: typeof a?.price === 'number' ? a.price : 0,
              tags: Array.isArray(a?.tags) ? a.tags : [],
              reasoning: typeof a?.reasoning === 'string' ? a.reasoning : '',
              teamFit: typeof a?.teamFit === 'string' ? a.teamFit : '',
            }));

          const summary = buildCopilotChangeSummary(plan.activities, safeModifiedActivities);
          setCopilotChangeSummary(summary);
          const safeActivities = safeModifiedActivities;
          onUpdatePlan({
            ...plan,
            activities: safeActivities,
            totalPrice: safeActivities.reduce((sum, a) => sum + (a.price || 0), 0),
            budgetOptions: undefined,
          });
        }
      } catch (error) {
        console.error('Copilot error:', error);
        setCopilotMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '抱歉，我现在暂时无法回复，请稍后再试。',
            suggestedActions: [],
          },
        ]);
      } finally {
        setCopilotLoading(false);
      }
    },
    [
      copilotInput,
      copilotLoading,
      plan,
      onUpdatePlan,
      teamProfilesStr,
      handleBudgetConfirm,
      handleVoteConfirm,
      handleTimeConfirm,
      handleReplaceConfirm,
      handleAddConfirm,
      handleDismissInteractive,
    ]
  );

  // 同步 ref，打破循环依赖
  useEffect(() => {
    handleCopilotSendRef.current = handleCopilotSend;
  }, [handleCopilotSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleCopilotSend();
      }
    },
    [handleCopilotSend]
  );

  // 处理初始消息（来自 ExecutionPanel 的"问管家"功能）
  useEffect(() => {
    if (initialMessage && isOpen && !copilotLoading) {
      setCopilotInput(initialMessage);
      // 延迟发送，确保面板已完全打开
      const timer = setTimeout(() => {
        void handleCopilotSend(initialMessage);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialMessage, isOpen]);

  const handleQuickBudget = useCallback(() => {
    if (!plan) return;
    const totalBudget = plan.activities.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
    setInteractiveComponent({
      type: 'BudgetSlider',
      min: 100,
      max: Math.max(500, totalBudget * 2),
      step: 50,
      currentValue: totalBudget,
      label: '调整预算',
      onConfirm: handleBudgetConfirm,
      onCancel: handleDismissInteractive,
    });
  }, [plan, handleBudgetConfirm, handleDismissInteractive]);

  const handleQuickVote = useCallback(() => {
    if (!plan) return;
    setInteractiveComponent({
      type: 'OptionVoting',
      title: '选择偏好活动',
      options:
        plan.activities.slice(0, 4).map((a) => ({
          id: a.id,
          label: a.title,
          description: a.type === 'food' ? `¥${a.price}` : `${a.timeLine}`,
        })) || [],
      maxSelections: 2,
      onVote: handleVoteConfirm,
    });
  }, [plan, handleVoteConfirm]);

  const handleQuickTime = useCallback(() => {
    if (!plan || plan.activities.length === 0) return;
    const firstActivity = plan.activities[0];
    const startTime = firstActivity.timeLine?.split('-')[0] || '12:00';
    setInteractiveComponent({
      type: 'TimeAdjuster',
      activityId: firstActivity.id,
      currentTime: startTime,
      minTime: '06:00',
      maxTime: '22:00',
      label: firstActivity.title,
      onConfirm: handleTimeConfirm,
      onCancel: handleDismissInteractive,
    });
  }, [plan, handleTimeConfirm, handleDismissInteractive]);

  const suggestedManagerActions = useMemo(
    () =>
      [
        ...(readiness && readiness.status !== 'ready'
          ? [
              {
                key: 'fallback',
                icon: <ShieldAlert className="w-4 h-4" />,
                label: readiness.status === 'adjust' ? '先微调' : '切稳妥方案',
                onClick: () => {
                  const firstFallback = readiness.fallbackOptions?.[0];
                  if (firstFallback) {
                    void handleFallbackApply(firstFallback.label);
                  } else {
                    void handleCopilotSend('帮我先把这条路线调整成更稳妥的版本');
                  }
                },
              },
            ]
          : [
              {
                key: 'execute',
                icon: <Zap className="w-4 h-4" />,
                label: '直接执行',
                onClick: () => onExecute(),
              },
            ]),
        {
          key: 'order',
          icon: <Wand2 className="w-4 h-4" />,
          label: '调顺路一点',
          onClick: () => {
            console.log('[action-track] order');
            void handleCopilotSend('帮我优化当前行程顺序，尽量更顺路');
          },
        },
        {
          key: 'meal',
          icon: <Soup className="w-4 h-4" />,
          label: '补一顿饭',
          onClick: () => {
            console.log('[action-track] meal');
            void handleCopilotSend('在这条路线里补一顿合适的餐厅');
          },
        },
        {
          key: 'weather',
          icon: <CloudSun className="w-4 h-4" />,
          label: '重看天气',
          onClick: () => {
            console.log('[action-track] weather');
            void handleCopilotSend('结合今天天气检查这条路线是否需要调整');
          },
        },
        {
          key: 'replace',
          icon: <ArrowRightLeft className="w-4 h-4" />,
          label: '换个地点',
          onClick: () => {
            console.log('[action-track] replace');
            void handleCopilotSend('帮我替换一个活动，保留整体节奏');
          },
        },
        {
          key: 'alternative',
          icon: <Wand2 className="w-4 h-4" />,
          label: '生成备用方案',
          onClick: () => {
            console.log('[action-track] alternative');
            void handleCopilotSend(
              '帮我重新生成一版完全不同的行程方案，换掉所有活动和餐厅，但保持相同的出行人数和风格'
            );
          },
        },
      ].slice(0, 3),
    [readiness, handleCopilotSend, handleFallbackApply, onExecute]
  );

  // 显示完整对话历史，而不是只显示最近2条
  const recentConversation = copilotMessages;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="absolute bottom-0 left-0 right-0 z-50 bg-[var(--app-bg)] rounded-t-[28px] shadow-[0_-16px_48px_rgba(0,0,0,0.12)] flex flex-col"
            style={{ height: '74vh' }}
          >
            <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-[var(--app-border)]/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--rose-soft)] border border-[var(--rose-strong)] flex items-center justify-center shadow-sm">
                  <XiaoMeiAvatar mood="thinking" size="w-7 h-7" />
                </div>
                <div>
                  <span className="font-bold text-[15px] text-[var(--app-ink)] block leading-none">
                    行程管家
                  </span>
                  <span className="text-[10px] text-[var(--app-text-soft)] font-bold">
                    先判断，再决定怎么调
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-[var(--app-card-soft)] hover:bg-gray-200 text-[var(--app-text)] px-3 py-1.5 rounded-xl text-[13px] font-bold transition-colors"
              >
                收起
              </button>
            </div>

            {/* 胶囊快捷按钮 - 常驻对话框上方 */}
            <div className="px-4 pt-3 pb-2 bg-[var(--app-bg)]">
              <div className="flex overflow-x-auto scrollbar-none gap-2 pb-1">
                <button
                  onClick={() => void handleQuickAction('replaceScenic')}
                  disabled={!plan || copilotLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--app-border)] bg-white shadow-sm active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  <MapPin className="w-3.5 h-3.5 text-[var(--rose-ink)]" />
                  <span className="text-[11px] font-bold">替换景点</span>
                </button>
                <button
                  onClick={() => void handleQuickAction('replaceRestaurant')}
                  disabled={!plan || copilotLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--app-border)] bg-white shadow-sm active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  <Utensils className="w-3.5 h-3.5 text-[var(--peach-ink)]" />
                  <span className="text-[11px] font-bold">更换餐厅</span>
                </button>
                <button
                  onClick={() => void handleQuickAction('adjustTime')}
                  disabled={!plan || copilotLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--app-border)] bg-white shadow-sm active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  <Clock className="w-3.5 h-3.5 text-[var(--mint-ink)]" />
                  <span className="text-[11px] font-bold">调整时间</span>
                </button>
                <button
                  onClick={() => void handleQuickAction('addActivity')}
                  disabled={!plan || copilotLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--app-border)] bg-white shadow-sm active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[var(--brand-ink)]" />
                  <span className="text-[11px] font-bold">增加活动</span>
                </button>
                <button
                  onClick={() => void handleQuickAction('adjustBudget')}
                  disabled={!plan || copilotLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--app-border)] bg-white shadow-sm active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  <Banknote className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold">预算调整</span>
                </button>
                {onStartCollaboration && (
                  <button
                    onClick={onStartCollaboration}
                    disabled={!plan}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--app-border)] bg-white shadow-sm active:scale-[0.97] disabled:opacity-50 transition-all"
                  >
                    <Users className="w-3.5 h-3.5 text-[var(--sky-ink)]" />
                    <span className="text-[11px] font-bold">发起协作</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-none">
              <div className="space-y-4">
                {/* 风险告警段落文字 - 放在最前面 */}
                {tripAlerts.length > 0 &&
                  (() => {
                    // 按问题类型分组
                    const groupedAlerts = tripAlerts.reduce(
                      (acc, alert) => {
                        const type = alert.title.split('：')[0];
                        if (!acc[type]) {
                          acc[type] = {
                            alerts: [],
                            title: type,
                          };
                        }
                        acc[type].alerts.push(alert);
                        return acc;
                      },
                      {} as Record<string, { alerts: typeof tripAlerts; title: string }>
                    );

                    return Object.values(groupedAlerts).map((group, groupIndex) => {
                      // 提取项目名称
                      const itemNames = group.alerts.map((alert) => {
                        const titlePart =
                          alert.title.split('：').slice(1).join('：') || alert.title;
                        return titlePart;
                      });

                      // 提取一个示例原因（从message中提取）
                      const exampleAlert = group.alerts[0];
                      let reason = '';
                      if (exampleAlert.message) {
                        const messageParts = exampleAlert.message.split('。');
                        reason = messageParts[0] || '';
                      }

                      return (
                        <div
                          key={groupIndex}
                          className="rounded-xl border border-amber-200 bg-[var(--warning-soft)] px-3 py-3"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <div className="text-[11px] font-bold text-[var(--app-ink)] mb-1">
                                {group.title}：共 {group.alerts.length} 项
                              </div>
                              <div className="text-[10px] text-[var(--app-text)] leading-relaxed">
                                <div>{itemNames.join('、')}</div>
                                {reason && (
                                  <div className="mt-1 text-[10px] text-[var(--app-text)]">
                                    原因：{reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}

                {/* AI沟通对话历史 */}
                {(recentConversation.length > 0 || copilotLoading) && (
                  <div>
                    <div className="mb-2 text-[13px] font-bold text-[var(--app-ink)]">沟通记录</div>
                    <div className="space-y-2">
                      {recentConversation.map((message, index) => {
                        // 安全地渲染消息内容，处理各种可能的格式
                        let displayContent = '';
                        try {
                          if (typeof message.content === 'string') {
                            displayContent = message.content;
                          } else if (
                            typeof message.content === 'object' &&
                            message.content !== null
                          ) {
                            // 如果content是对象，尝试提取有用信息
                            const contentObj = message.content as Record<string, unknown>;
                            if (contentObj.title && typeof contentObj.title === 'string') {
                              displayContent = contentObj.title;
                            } else if (
                              contentObj.message &&
                              typeof contentObj.message === 'string'
                            ) {
                              displayContent = contentObj.message;
                            } else {
                              displayContent = '收到新消息';
                            }
                          } else if (message.content) {
                            displayContent = String(message.content);
                          } else {
                            displayContent = '';
                          }
                        } catch {
                          displayContent = '收到新消息';
                        }

                        return (
                          <div
                            key={`${message.role}-${index}`}
                            className={`rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'ml-10 bg-white text-[var(--app-ink)] border border-[var(--rose-strong)]'
                                : 'mr-10 bg-[var(--app-card-soft)] text-[var(--app-ink)] border border-[var(--app-border)]'
                            }`}
                          >
                            <div className="text-[13px] font-semibold leading-relaxed whitespace-pre-wrap">
                              {displayContent}
                            </div>
                          </div>
                        );
                      })}
                      {copilotLoading && (
                        <div className="mr-10 rounded-2xl border border-[var(--app-border)] bg-white px-4 py-3">
                          <div className="flex gap-1.5">
                            <div
                              className="h-2 w-2 rounded-full bg-gray-300 animate-bounce"
                              style={{ animationDelay: '0ms' }}
                            ></div>
                            <div
                              className="h-2 w-2 rounded-full bg-gray-300 animate-bounce"
                              style={{ animationDelay: '150ms' }}
                            ></div>
                            <div
                              className="h-2 w-2 rounded-full bg-gray-300 animate-bounce"
                              style={{ animationDelay: '300ms' }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI交互调整卡片 - AI 返回选项后显示，用户从中选择再确认 */}
                {interactiveComponent && (
                  <div>
                    <div className="mb-2 text-[13px] font-bold text-[var(--app-ink)]">
                      AI调整建议
                    </div>
                    <InteractiveComponent component={interactiveComponent} />
                  </div>
                )}

                {/* AI修改总结 - 仅在行程修改后显示 */}
                {copilotChangeSummary && copilotChangeSummary.changedCount > 0 && (
                  <div>
                    <div className="mb-2 text-[13px] font-bold text-[var(--app-ink)]">
                      这次帮你改了什么
                    </div>
                    <div className="rounded-[24px] border border-[var(--peach-strong)] bg-[rgba(255,241,225,0.82)] px-4 py-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-white/80 px-3 py-3">
                          <div className="text-[10px] font-bold text-[var(--app-text-soft)]">
                            调整项
                          </div>
                          <div className="mt-1 text-[15px] font-bold text-[var(--app-ink)]">
                            {copilotChangeSummary.changedCount}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-3">
                          <div className="text-[10px] font-bold text-[var(--app-text-soft)]">
                            预算变化
                          </div>
                          <div className="mt-1 text-[15px] font-bold text-[var(--app-ink)]">
                            {copilotChangeSummary.budgetDelta > 0 ? '+' : ''}
                            {copilotChangeSummary.budgetDelta} 元
                          </div>
                        </div>
                      </div>
                      {copilotChangeSummary.replacements.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {copilotChangeSummary.replacements.slice(0, 3).map((item, index) => (
                            <div
                              key={`${item.from}-${index}`}
                              className="rounded-2xl bg-white px-3 py-3"
                            >
                              <div className="text-[13px] font-bold text-[var(--app-ink)]">
                                {item.from} {'->'} {item.to}
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                                {item.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {copilotChangeSummary.movedTitles.length > 0 && (
                        <div className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--peach-ink)]">
                          顺序也一起调过：{copilotChangeSummary.movedTitles.slice(0, 3).join('、')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 协作投票实时状态 */}
                {collabVoteSummary && collabVoteSummary.total > 0 && (
                  <div className="mb-4 p-3 rounded-2xl bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-500" />
                      <span className="text-[13px] font-bold text-[var(--app-ink)]">
                        {collabVoteSummary.total} 人已投票 · {collabVoteSummary.consensus}
                      </span>
                    </div>
                  </div>
                )}

                {/* 收藏的常用指令 */}
                {favoritePrompts.length > 0 && (
                  <div>
                    <div className="mb-2 text-[13px] font-bold text-[var(--app-ink)]">常用指令</div>
                    <div className="space-y-1.5">
                      {favoritePrompts.map((prompt, i) => (
                        <div
                          key={prompt}
                          className="flex items-center gap-2 rounded-xl bg-[var(--warning-soft)] border border-amber-100 px-3 py-2"
                        >
                          <button
                            onClick={() => {
                              setCopilotInput(prompt);
                            }}
                            className="flex-1 text-left text-[11px] font-medium text-[var(--app-ink)] truncate hover:text-[var(--app-ink)]"
                          >
                            {prompt.slice(0, 40)}
                            {prompt.length > 40 ? '...' : ''}
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite(prompt)}
                            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-amber-100 text-amber-400"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 bg-white/88 backdrop-blur-xl border-t border-[var(--app-border)]/40">
              <div className="bg-[var(--app-card-soft)] rounded-2xl flex items-center px-3 py-1.5 border border-[var(--app-border)]/80 focus-within:border-[var(--rose-strong)] transition-colors">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="怎么改这条路线"
                  className="flex-1 bg-transparent border-none text-[13px] font-semibold px-1.5 focus:ring-0 outline-none"
                  disabled={copilotLoading}
                />
                {copilotInput.trim() ? (
                  <>
                    <button
                      onClick={handleSaveFavorite}
                      className="w-8 h-8 flex items-center justify-center text-amber-400 hover:text-amber-500 active:scale-90 transition-all"
                      aria-label="收藏指令"
                      title="收藏为常用指令"
                    >
                      <Star
                        className="w-4 h-4"
                        fill={
                          favoritePrompts.includes(copilotInput.trim()) ? 'currentColor' : 'none'
                        }
                      />
                    </button>
                    <button
                      onClick={() => void handleCopilotSend()}
                      disabled={copilotLoading}
                      className="w-9 h-9 flex items-center justify-center bg-[var(--app-ink)] text-white rounded-xl shadow-sm active:scale-90 transition-transform"
                      aria-label="发送"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="w-9 h-9 flex items-center justify-center text-[var(--app-text-soft)]">
                    <Mic className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
