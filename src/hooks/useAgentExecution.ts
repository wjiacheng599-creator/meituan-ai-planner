import { useState, useCallback, useRef } from 'react';
import type { Activity } from '../services/ai';
import type { ExecutionPlan, ToolName } from '../services/tools';
import { agentExecute, type AgentStep, type AgentResult } from '../services/agent';
import { buildExecutionPlan, findCallIndex } from '../services/tools';
import type { TravelMode } from '../types';

interface UseAgentExecutionOptions {
  planId: string;
  planTitle: string;
  city: string;
  peopleCount: number;
  travelMode: TravelMode;
  taxiSegments: Array<{
    from: string;
    to: string;
    time: string;
    tierLabel?: string;
    estimatedFare?: number;
    estimatedWaitMinutes?: number;
  }>;
  onMarkBooked?: (ids: string[]) => void;
  onStep?: (step: AgentStep) => void;
}

interface UseAgentExecutionReturn {
  isExecuting: boolean;
  isPaused: boolean;
  executionPlan: ExecutionPlan | null;
  agentResult: AgentResult | null;
  agentSteps: AgentStep[];
  startExecution: (activities: Activity[]) => Promise<AgentResult>;
  retryFailed: (activities: Activity[]) => Promise<AgentResult>;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelExecution: () => void;
  handleStepResult: (
    step: AgentStep,
    activities: Activity[]
  ) => { failedActivity: Activity | null; reason?: string; message?: string } | null;
}

export function useAgentExecution(options: UseAgentExecutionOptions): UseAgentExecutionReturn {
  const { planId, planTitle, city, peopleCount, travelMode, taxiSegments, onMarkBooked, onStep } =
    options;

  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const skippedActivityIdsRef = useRef<Set<string>>(new Set());

  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExecuting(false);
    setIsPaused(false);
  }, []);

  const pauseExecution = useCallback(() => {
    setIsPaused(true);
    setIsExecuting(false);
  }, []);

  const resumeExecution = useCallback(() => {
    setIsPaused(false);
    setIsExecuting(true);
  }, []);

  const handleStepResult = useCallback(
    (
      step: AgentStep,
      activities: Activity[]
    ): { failedActivity: Activity | null; reason?: string; message?: string } | null => {
      if (step.status !== 'failed' || !step.toolArgs) return null;

      const failedActivityName =
        typeof step.toolArgs.name === 'string'
          ? step.toolArgs.name
          : typeof step.toolArgs.to === 'string'
            ? step.toolArgs.to
            : '';

      if (!failedActivityName) return null;

      const failedActivity = activities.find((act) => act.title === failedActivityName);
      if (!failedActivity) return null;

      let reason = 'unknown_error';
      const message = step.toolResult?.message || '';
      const msg = message.toLowerCase();

      if (
        msg.includes('打烊') ||
        msg.includes('休息') ||
        msg.includes('关门') ||
        msg.includes('不可用')
      ) {
        reason = 'merchant_unavailable';
      } else if (msg.includes('已满') || msg.includes('预约满') || msg.includes('时段')) {
        reason = 'time_conflict';
      } else if (msg.includes('人') && (msg.includes('太多') || msg.includes('超过'))) {
        reason = 'capacity_exceeded';
      } else if (msg.includes('网络') || msg.includes('连接') || msg.includes('超时')) {
        reason = 'network_error';
      }

      return { failedActivity, reason, message };
    },
    []
  );

  const startExecution = useCallback(
    async (activities: Activity[]): Promise<AgentResult> => {
      if (activities.length === 0) {
        return {
          answer: '没有选中的活动',
          steps: [],
          totalToolCalls: 0,
          successCount: 0,
          failCount: 0,
        };
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const filteredActivities = activities.filter(
        (act) => !skippedActivityIdsRef.current.has(act.id)
      );

      const basePlan = buildExecutionPlan(filteredActivities, planTitle, peopleCount, {
        city,
        travelMode,
      });

      setExecutionPlan({ ...basePlan, status: 'running' });
      setIsExecuting(true);
      setAgentSteps([]);
      setAgentResult(null);

      const result = await agentExecute(
        {
          planId,
          activities: filteredActivities,
          planTitle,
          city,
          peopleCount,
          onStep: (step) => {
            setAgentSteps((prev) => {
              const idx = prev.findIndex((item) => item.id === step.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = step;
                return next;
              }
              return [...prev, step];
            });

            if (step.type === 'tool_result') {
              setExecutionPlan((prev) => {
                if (!prev) return prev;
                const nextCalls = [...prev.calls];
                const targetIndex = findCallIndex(nextCalls, step);

                if (targetIndex >= 0) {
                  nextCalls[targetIndex] = {
                    ...nextCalls[targetIndex],
                    tool: (step.toolName || nextCalls[targetIndex].tool) as ToolName,
                    label: buildToolLabel(step.toolName, step.toolArgs),
                    icon: buildToolIconName(step.toolName),
                    input: step.toolArgs || nextCalls[targetIndex].input,
                    status: step.status,
                    result: step.toolResult,
                    error: step.status === 'failed' ? step.toolResult?.message : undefined,
                    finishedAt: step.finishedAt,
                  };
                }

                const upcomingIndex = nextCalls.findIndex((call) => call.status === 'pending');
                if (upcomingIndex >= 0) {
                  nextCalls[upcomingIndex] = { ...nextCalls[upcomingIndex], status: 'running' };
                }

                return { ...prev, calls: nextCalls };
              });
            }

            onStep?.(step);
          },
        },
        { signal: abortController.signal }
      );

      setAgentResult(result);
      setIsExecuting(false);

      const successIds = filteredActivities
        .filter((activity) =>
          result.steps.some(
            (step) =>
              step.type === 'tool_result' &&
              step.status === 'success' &&
              (((step.toolName === 'make_reservation' || step.toolName === 'book_activity') &&
                step.toolArgs?.name &&
                (String(step.toolArgs.name) === activity.title ||
                  String(step.toolArgs.name).includes(activity.title) ||
                  activity.title.includes(String(step.toolArgs.name)))) ||
                (step.toolName === 'dispatch_taxi' && step.toolArgs?.to === activity.title))
          )
        )
        .map((activity) => activity.id);

      if (successIds.length > 0) onMarkBooked?.(successIds);

      setExecutionPlan((prev) =>
        prev
          ? {
              ...prev,
              status: result.failCount > 0 ? 'partial_failed' : 'completed',
              completedAt: Date.now(),
              calls: prev.calls.map((call) =>
                call.status === 'running'
                  ? { ...call, status: 'failed', error: '执行超时，未收到结果' }
                  : call
              ),
            }
          : prev
      );

      return result;
    },
    [planId, planTitle, city, peopleCount, travelMode, taxiSegments, onMarkBooked, onStep]
  );

  const retryFailed = useCallback(
    async (activities: Activity[]): Promise<AgentResult> => {
      const failedIds = new Set<string>();

      executionPlan?.calls.forEach((call) => {
        if (call.status === 'failed' && typeof call.input?.name === 'string') {
          failedIds.add(call.input.name);
        }
      });

      agentResult?.steps.forEach((step) => {
        if (
          step.type === 'tool_result' &&
          step.status === 'failed' &&
          typeof step.toolArgs?.name === 'string'
        ) {
          failedIds.add(step.toolArgs.name);
        }
      });

      const retryActivities = activities.filter((activity) => failedIds.has(activity.title));
      if (retryActivities.length === 0) {
        return {
          answer: '没有需要重试的活动',
          steps: [],
          totalToolCalls: 0,
          successCount: 0,
          failCount: 0,
        };
      }

      return startExecution(retryActivities);
    },
    [executionPlan, agentResult, startExecution]
  );

  const skipActivity = useCallback((activityId: string) => {
    skippedActivityIdsRef.current.add(activityId);
    setExecutionPlan((prev) => {
      if (!prev) return prev;
      const activity = prev.calls.find(
        (call) => call.input?.name === activityId || call.input?.to === activityId
      );
      if (!activity) return prev;
      return {
        ...prev,
        calls: prev.calls.filter(
          (call) => call.input?.name !== activityId && call.input?.to !== activityId
        ),
      };
    });
  }, []);

  return {
    isExecuting,
    isPaused,
    executionPlan,
    agentResult,
    agentSteps,
    startExecution,
    retryFailed,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    handleStepResult,
  };
}

function buildToolLabel(toolName?: string, toolArgs?: Record<string, unknown>): string {
  const name = typeof toolArgs?.name === 'string' ? toolArgs.name : '';
  const from = typeof toolArgs?.from === 'string' ? toolArgs.from : '';
  const to = typeof toolArgs?.to === 'string' ? toolArgs.to : '';
  if (toolName === 'search_restaurant') return `查询 ${name}`;
  if (toolName === 'check_availability') return `${name} 可用时段`;
  if (toolName === 'make_reservation') return `预订 ${name}`;
  if (toolName === 'book_activity') return `预约 ${name}`;
  if (toolName === 'dispatch_taxi') return `约车 ${from} → ${to}`;
  if (toolName === 'calculate_route') return '优化出行路线';
  if (toolName === 'check_queue') return `查询排队 ${name}`;
  if (toolName === 'join_queue') return `取号 ${name}`;
  return '执行任务';
}

function buildToolIconName(toolName?: string): string {
  if (toolName === 'search_restaurant') return 'search';
  if (toolName === 'check_availability') return 'calendar';
  if (toolName === 'make_reservation') return 'check';
  if (toolName === 'book_activity') return 'ticket';
  if (toolName === 'dispatch_taxi') return 'map';
  if (toolName === 'calculate_route') return 'map';
  if (toolName === 'check_queue') return 'hourglass';
  if (toolName === 'join_queue') return 'ticket';
  return 'zap';
}
