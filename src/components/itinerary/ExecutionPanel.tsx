import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { ExecutionPlan, ToolName } from '../../services/tools';
import { getDataSourceLabel } from '../../services/tools';
import type { AgentResult } from '../../services/agent';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCw,
  BadgeCheck,
  Search,
  CalendarCheck,
  Ticket,
  Map as MapIcon,
  Hourglass,
  Zap,
  GitBranch,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import TimelineAdjustmentPanel, {
  generateMockAdjustments,
  type TimelineAdjustment,
} from './TimelineAdjustmentPanel';

interface ExecutionGroup {
  id: string;
  title: string;
  type: 'route' | 'service';
  calls: ExecutionPlan['calls'];
  status: 'pending' | 'running' | 'success' | 'failed';
  summary: string;
}

export interface Alternative {
  id: string;
  name: string;
  distance: number;
  rating: number;
  price: number;
  address: string;
}

export interface ExecutionRunSummary {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'partial_failed' | 'cancelled';
  total: number;
  successCount: number;
  failCount: number;
  pendingCount: number;
  answer?: string;
}

function getToolIcon(icon: string) {
  if (icon === 'search') return <Search className="w-4 h-4 text-gray-600" />;
  if (icon === 'calendar') return <CalendarCheck className="w-4 h-4 text-gray-600" />;
  if (icon === 'ticket') return <Ticket className="w-4 h-4 text-gray-600" />;
  if (icon === 'map') return <MapIcon className="w-4 h-4 text-gray-600" />;
  if (icon === 'hourglass') return <Hourglass className="w-4 h-4 text-gray-600" />;
  if (icon === 'check') return <BadgeCheck className="w-4 h-4 text-gray-600" />;
  return <Zap className="w-4 h-4 text-gray-600" />;
}

function formatExecutionMessage(label: string, message?: string): string {
  if (!message) return '';
  const normalized = message.replace(/^(\[[^\]]+\]\s*)/, '').trim();
  const stripped = label
    .replace(/^查询\s*/, '')
    .replace(/^预订\s*/, '')
    .replace(/^预约\s*/, '')
    .replace(/ 可用时段$/, '')
    .trim();

  if (!stripped) return normalized;
  return (
    normalized
      .split(stripped)
      .join('')
      .replace(/^[，,\s]+/, '')
      .trim() || normalized
  );
}

function getCallTargetName(call: ExecutionPlan['calls'][number]): string {
  if (typeof call.input?.name === 'string' && call.input.name.trim()) return call.input.name;
  return call.label
    .replace(/^查询\s*/, '')
    .replace(/^预订\s*/, '')
    .replace(/^预约\s*/, '')
    .replace(/ 可用时段$/, '')
    .trim();
}

function buildExecutionGroups(executionPlan: ExecutionPlan): ExecutionGroup[] {
  const groups: ExecutionGroup[] = [];
  const serviceMap = new Map<string, ExecutionPlan['calls']>();

  executionPlan.calls.forEach((call) => {
    if (call.tool === 'calculate_route') {
      groups.push({
        id: call.id,
        title: '路线总览',
        type: 'route',
        calls: [call],
        status:
          call.status === 'failed'
            ? 'failed'
            : call.status === 'running'
              ? 'running'
              : call.status === 'success'
                ? 'success'
                : 'pending',
        summary: formatExecutionMessage(call.label, call.result?.message) || '正在优化路线',
      });
      return;
    }

    const key = getCallTargetName(call);
    if (!serviceMap.has(key)) serviceMap.set(key, []);
    serviceMap.get(key)?.push(call);
  });

  let groupIdx = 0;
  serviceMap.forEach((calls, title) => {
    const hasFailed = calls.some((call) => call.status === 'failed');
    const hasRunning = calls.some((call) => call.status === 'running');
    const successCall = [...calls]
      .reverse()
      .find((call) => call.status === 'success' && call.result?.message);
    const pendingCount = calls.filter((call) => call.status === 'pending').length;
    const status: ExecutionGroup['status'] = hasFailed
      ? 'failed'
      : hasRunning
        ? 'running'
        : pendingCount === calls.length
          ? 'pending'
          : 'success';
    const fallbackSummary = hasFailed
      ? calls.find((call) => call.status === 'failed')?.error ||
        calls.find((call) => call.status === 'failed')?.result?.message ||
        '处理中断'
      : hasRunning
        ? '正在继续处理'
        : `${calls.filter((call) => call.status === 'success').length} 个步骤已完成`;

    groups.push({
      id: `group_${title}_${groupIdx++}`,
      title,
      type: 'service',
      calls,
      status,
      summary: successCall
        ? formatExecutionMessage(successCall.label, successCall.result?.message)
        : fallbackSummary,
    });
  });

  return groups;
}

function calculateProgress(executionPlan: ExecutionPlan): number {
  if (!executionPlan.calls || executionPlan.calls.length === 0) return 0;
  const total = executionPlan.calls.length;
  const completed = executionPlan.calls.filter(
    (call) => call.status === 'success' || call.status === 'failed'
  ).length;
  return Math.round((completed / total) * 100);
}

export interface ExecutionPanelProps {
  executionPlan: ExecutionPlan | null;
  executionRun?: ExecutionRunSummary | null;
  isExecuting: boolean;
  isPaused?: boolean;
  agentResult: AgentResult | null;
  onClose: () => void;
  onProceedPayment?: () => void;
  onRetryFailed?: () => void;
  onContinue?: () => void;
  onCancel?: () => void;
  activities?: Array<{ title: string; timeLine: string }>;
  onAskCopilot?: (failedGroups: ExecutionGroup[]) => void;
  onRetryGroup?: (groupId: string) => void;
  onSearchAlternative?: (groupId: string) => void;
  onSkipGroup?: (groupId: string) => void;
  alternatives?: Record<string, Alternative[]>;
  onSelectAlternative?: (groupId: string, alternative: Alternative) => void;
}

export interface ParallelExecutionGroup {
  id: string;
  calls: ExecutionPlan['calls'];
  status: 'pending' | 'running' | 'completed';
}

export default function ExecutionPanel({
  executionPlan,
  executionRun,
  isExecuting,
  isPaused,
  agentResult,
  onClose,
  onProceedPayment,
  onRetryFailed,
  onContinue,
  onCancel,
  activities = [],
  onAskCopilot,
  onRetryGroup,
  onSearchAlternative,
  onSkipGroup,
  alternatives,
  onSelectAlternative,
}: ExecutionPanelProps) {
  const executionGroups = useMemo(
    () => (executionPlan ? buildExecutionGroups(executionPlan) : []),
    [executionPlan]
  );
  const progress = useMemo(
    () => (executionPlan ? calculateProgress(executionPlan) : 0),
    [executionPlan]
  );
  const serviceGroups = useMemo(
    () => executionGroups.filter((group) => group.type === 'service'),
    [executionGroups]
  );

  const timelineAdjustments = useMemo(() => {
    if (!executionPlan || executionPlan.status !== 'running') return [];
    return generateMockAdjustments(activities);
  }, [executionPlan, activities]);

  const parallelGroups = useMemo((): ParallelExecutionGroup[] => {
    if (!executionPlan) return [];
    const groups: ParallelExecutionGroup[] = [];
    let currentBatch: ExecutionPlan['calls'] = [];

    for (let i = 0; i < executionPlan.calls.length; i++) {
      const call = executionPlan.calls[i];
      if (call.tool === 'calculate_route') {
        if (currentBatch.length > 0) {
          groups.push({
            id: `batch_${groups.length}`,
            calls: [...currentBatch],
            status: currentBatch.some((c) => c.status === 'running')
              ? 'running'
              : currentBatch.every((c) => c.status === 'success' || c.status === 'failed')
                ? 'completed'
                : 'pending',
          });
          currentBatch = [];
        }
        groups.push({
          id: `route_${i}`,
          calls: [call],
          status:
            call.status === 'running'
              ? 'running'
              : call.status === 'success'
                ? 'completed'
                : 'pending',
        });
      } else {
        currentBatch.push(call);
        if (
          currentBatch.length === 3 ||
          i === executionPlan.calls.length - 1 ||
          (executionPlan.calls[i + 1] && executionPlan.calls[i + 1].tool === 'calculate_route')
        ) {
          groups.push({
            id: `batch_${groups.length}`,
            calls: [...currentBatch],
            status: currentBatch.some((c) => c.status === 'running')
              ? 'running'
              : currentBatch.every((c) => c.status === 'success' || c.status === 'failed')
                ? 'completed'
                : 'pending',
          });
          currentBatch = [];
        }
      }
    }

    return groups;
  }, [executionPlan]);

  return (
    <>
      {executionPlan && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => !isExecuting && onClose()}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="absolute bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-[0_-16px_48px_rgba(0,0,0,0.15)] max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="px-5 pt-3 pb-4 border-b border-gray-100">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 bg-gray-200 rounded-full"></div>
              </div>
              {isExecuting && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-gray-500">执行进度</span>
                    <span className="text-[11px] font-bold text-[var(--sky-ink)]">{progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[var(--sky-strong)] to-[var(--sky-ink)] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      executionPlan.status === 'completed'
                        ? 'bg-[var(--mint-soft)]'
                        : executionPlan.status === 'partial_failed'
                          ? 'bg-[var(--peach-soft)]'
                          : 'bg-gray-100'
                    }`}
                  >
                    {isExecuting ? (
                      <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                    ) : executionPlan.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--mint-ink)]" />
                    ) : (
                      <AlertCircle
                        className={`w-5 h-5 ${executionPlan.status === 'partial_failed' ? 'text-[var(--peach-ink)]' : 'text-gray-600'}`}
                      />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-[15px] text-gray-900 block leading-none">
                      {isExecuting
                        ? '正在处理'
                        : executionPlan.status === 'completed'
                          ? '预订完成'
                          : executionPlan.status === 'partial_failed'
                            ? '部分未完成'
                            : '可继续执行'}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {serviceGroups.filter((group) => group.status === 'success').length}/
                        {serviceGroups.length}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-[var(--sky-ink)] bg-[var(--sky-soft)]">
                        {getDataSourceLabel().label}
                      </span>
                    </div>
                  </div>
                </div>
                {!isExecuting && (
                  <button
                    onClick={onClose}
                    className="bg-gray-100 px-3 py-1.5 rounded-xl text-[13px] font-bold text-gray-600"
                  >
                    关闭
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* AI 执行摘要：精简展示，去除冗余 */}
              {!isExecuting &&
                (executionRun?.answer || agentResult?.answer) &&
                (() => {
                  const rawAnswer = executionRun?.answer || agentResult?.answer || '';
                  // 精简：只保留核心信息（✅/❌ 行），去掉重复的总结性文案
                  const lines = rawAnswer.split('\n').filter((l) => l.trim());
                  const keyLines = lines.filter(
                    (l) =>
                      l.includes('✅') ||
                      l.includes('❌') ||
                      l.includes('预订') ||
                      l.includes('确认码') ||
                      l.includes('失败')
                  );
                  const displayText =
                    keyLines.length > 0 ? keyLines.join('\n') : rawAnswer.substring(0, 200);
                  return (
                    <div
                      className={`mb-4 rounded-2xl px-4 py-3 border ${
                        executionPlan.status === 'completed'
                          ? 'bg-[rgba(225,250,240,0.6)] border-[var(--mint-strong)]'
                          : executionPlan.status === 'partial_failed'
                            ? 'bg-[rgba(255,241,225,0.6)] border-[var(--peach-strong)]'
                            : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="text-[13px] font-semibold text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {displayText}
                      </div>
                    </div>
                  );
                })()}

              <TimelineAdjustmentPanel
                adjustments={timelineAdjustments}
                isAdjusting={isExecuting}
              />

              {isExecuting && parallelGroups.length > 1 && (
                <div className="mb-4 rounded-2xl bg-gradient-to-r from-[var(--sky-soft)] to-[var(--info-soft)] border border-[var(--sky-strong)] p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch className="w-4 h-4 text-[var(--sky-ink)]" />
                    <span className="text-[13px] font-bold text-[var(--sky-ink)]">并行执行</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--sky-soft)] text-[var(--sky-ink)]">
                      {parallelGroups.length} 个批次
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {parallelGroups.map((group, index) => (
                      <React.Fragment key={group.id}>
                        <div
                          className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            group.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : group.status === 'running'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {group.calls.length > 1 && <Zap className="w-3 h-3" />}
                          {group.calls
                            .slice(0, 2)
                            .map((c) => {
                              const label = getCallTargetName(c);
                              return label.slice(0, 4);
                            })
                            .join('+')}
                          {group.calls.length > 2 && `+${group.calls.length - 2}`}
                        </div>
                        {index < parallelGroups.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {executionGroups.map((group, index) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-[24px] border px-4 py-4 transition-all ${
                      group.status === 'success'
                        ? 'bg-[rgba(238,248,241,0.82)] border-[var(--mint-strong)]'
                        : group.status === 'running'
                          ? 'bg-[rgba(242,245,251,0.82)] border-[var(--sky-strong)]'
                          : group.status === 'failed'
                            ? 'bg-[rgba(255,240,242,0.72)] border-[var(--rose-strong)]'
                            : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 flex items-center justify-center w-6 h-6 mt-0.5">
                        {getToolIcon(group.calls[0]?.icon || 'map')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-gray-800 truncate">
                              {group.title}
                            </div>
                            <div
                              className={`mt-1 text-[11px] font-semibold ${group.status === 'success' ? 'text-[var(--mint-ink)]' : group.status === 'failed' ? 'text-[var(--rose-ink)]' : 'text-gray-600'}`}
                            >
                              {group.status === 'failed' ? '执行失败' : group.summary}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {group.status === 'success' && (
                              <CheckCircle2 className="w-5 h-5 text-[var(--mint-ink)]" />
                            )}
                            {group.status === 'running' && (
                              <Loader2 className="w-5 h-5 text-[var(--sky-ink)] animate-spin" />
                            )}
                            {group.status === 'failed' && (
                              <XCircle className="w-5 h-5 text-[var(--rose-ink)]" />
                            )}
                            {group.status === 'pending' && (
                              <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                            )}
                          </div>
                        </div>

                        {group.type === 'service' && group.calls.length > 1 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.calls.map((call) => (
                              <div
                                key={call.id}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  call.status === 'success'
                                    ? 'bg-white/80 text-[var(--mint-ink)] border border-[var(--mint-strong)]'
                                    : call.status === 'running'
                                      ? 'bg-white text-[var(--sky-ink)] border border-[var(--sky-strong)]'
                                      : call.status === 'failed'
                                        ? 'bg-white text-[var(--rose-ink)] border border-[var(--rose-strong)]'
                                        : 'bg-white/70 text-gray-400 border border-gray-100'
                                }`}
                              >
                                {call.tool === 'search_restaurant'
                                  ? '查询'
                                  : call.tool === 'check_availability'
                                    ? '时段'
                                    : call.tool === 'make_reservation'
                                      ? '预订'
                                      : call.tool === 'book_activity'
                                        ? '预约'
                                        : '执行'}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 失败内联操作按钮 */}
                        {group.status === 'failed' && !isExecuting && (
                          <div className="mt-3 pt-3 border-t border-rose-200/50">
                            {/* 失败原因 */}
                            {group.calls[0]?.error && (
                              <div className="mb-3 rounded-xl bg-[var(--rose-soft)] border border-[var(--rose-strong)] px-3 py-2.5">
                                <div className="text-[12px] font-bold text-[var(--rose-ink)] leading-relaxed">
                                  {group.calls[0].error}
                                </div>
                              </div>
                            )}

                            {/* 替代推荐（自动显示） */}
                            {alternatives &&
                              alternatives[group.id] &&
                              alternatives[group.id].length > 0 && (
                                <div className="mb-3 rounded-xl bg-orange-50 border border-orange-200 p-3">
                                  <div className="text-[11px] font-bold text-orange-600 mb-2 flex items-center gap-1">
                                    <RotateCw className="w-3 h-3" /> 替代推荐
                                  </div>
                                  {alternatives[group.id].slice(0, 2).map((alt: Alternative) => (
                                    <div
                                      key={alt.id}
                                      className="flex items-center justify-between p-2 bg-white rounded-lg mb-1.5"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[13px] font-bold text-gray-800 truncate">
                                          {alt.name}
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                          距离 {alt.distance}km · 评分 {alt.rating} · 人均 ¥
                                          {alt.price}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => onSelectAlternative?.(group.id, alt)}
                                        className="ml-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform shrink-0"
                                      >
                                        选择
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                            <div className="flex gap-2 flex-wrap">
                              {onRetryGroup && (
                                <button
                                  onClick={() => onRetryGroup(group.id)}
                                  className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                                >
                                  重试
                                </button>
                              )}
                              {onSearchAlternative && (
                                <button
                                  onClick={() => onSearchAlternative(group.id)}
                                  className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                                >
                                  搜索替代
                                </button>
                              )}
                              {onSkipGroup && (
                                <button
                                  onClick={() => onSkipGroup(group.id)}
                                  className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                                >
                                  跳过
                                </button>
                              )}
                              {onAskCopilot && (
                                <button
                                  onClick={() => onAskCopilot([group])}
                                  className="px-3 py-1.5 bg-[var(--peach-soft)] text-[var(--peach-ink)] rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                  <MessageCircle className="w-3 h-3" /> 问管家
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* agentResult 区块已整合到顶部 AI 摘要，此处不再重复 */}

            {isExecuting ? (
              <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex gap-2">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3.5 bg-red-50 text-red-700 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                >
                  <XCircle className="w-4 h-4" /> 取消执行
                </button>
              </div>
            ) : isPaused ? (
              <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex gap-2">
                <button
                  onClick={onContinue}
                  className="flex-1 py-3.5 bg-orange-500 text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" /> 继续执行
                </button>
                <button
                  onClick={onClose}
                  className="py-3.5 px-5 bg-gray-100 text-gray-700 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer border border-gray-200"
                >
                  关闭
                </button>
              </div>
            ) : (
              <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex gap-2">
                {executionPlan.status === 'partial_failed' && onAskCopilot && (
                  <button
                    onClick={() =>
                      onAskCopilot(executionGroups.filter((g) => g.status === 'failed'))
                    }
                    className="flex-1 py-3.5 bg-[var(--peach-ink)] text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <MessageCircle className="w-4 h-4" /> 问管家调整行程
                  </button>
                )}
                {executionPlan.status === 'partial_failed' && (
                  <button
                    onClick={onRetryFailed}
                    className="py-3.5 px-5 bg-gray-100 rounded-2xl text-[13px] font-bold text-gray-700 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <RotateCw className="w-4 h-4" /> 重试失败项
                  </button>
                )}
                {executionPlan.status === 'completed' && (
                  <button
                    onClick={onProceedPayment}
                    className="app-btn-primary flex-1 py-3.5 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    去付款
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`py-3.5 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer ${
                    executionPlan.status === 'completed'
                      ? 'px-5 bg-gray-100 text-gray-700 border border-gray-200'
                      : 'flex-1 bg-gray-900 text-white'
                  }`}
                >
                  {executionPlan.status === 'completed' ? '稍后' : '关闭'}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </>
  );
}
