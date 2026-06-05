import type { PlannerTaskState, PlannerTaskStatus } from '../types';

export type PlannerTaskLifecycleStatus =
  | 'planned'
  | 'selected'
  | 'booked'
  | 'executed'
  | 'completed';

export type PlannerTaskMeta = {
  key: PlannerTaskLifecycleStatus;
  label: string;
  shortLabel: string;
  hint: string;
  accentClassName: string;
  pillClassName: string;
};

const TASK_META: Record<PlannerTaskLifecycleStatus, PlannerTaskMeta> = {
  planned: {
    key: 'planned',
    label: '已规划',
    shortLabel: '规划中',
    hint: '还没开始挑选要执行的服务',
    accentClassName: 'text-sky-700 bg-sky-50',
    pillClassName: 'bg-sky-50 text-sky-700 border-sky-100/80',
  },
  selected: {
    key: 'selected',
    label: '已挑选',
    shortLabel: '待预订',
    hint: '已选好服务，下一步可以直接预订',
    accentClassName: 'text-violet-700 bg-violet-50',
    pillClassName: 'bg-violet-50 text-violet-700 border-violet-100/80',
  },
  booked: {
    key: 'booked',
    label: '已预订',
    shortLabel: '待出发',
    hint: '服务已锁定，可以按路线出发',
    accentClassName: 'text-amber-700 bg-amber-50',
    pillClassName: 'bg-amber-50 text-amber-700 border-amber-100/80',
  },
  executed: {
    key: 'executed',
    label: '已执行',
    shortLabel: '待出发',
    hint: 'AI 已完成预订，等待出发体验',
    accentClassName: 'text-teal-700 bg-teal-50',
    pillClassName: 'bg-teal-50 text-teal-700 border-teal-100/80',
  },
  completed: {
    key: 'completed',
    label: '已完成',
    shortLabel: '已归档',
    hint: '这条任务已经完成，可以回看回忆',
    accentClassName: 'text-emerald-700 bg-emerald-50',
    pillClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100/80',
  },
};

export function normalizePlannerTaskStatus(
  status?: PlannerTaskStatus | null
): PlannerTaskLifecycleStatus {
  if (status === 'completed' || status === 'archived') return 'completed';
  if (status === 'executed') return 'executed';
  if (status === 'booked' || status === 'executing') return 'booked';
  if (status === 'selected') return 'selected';
  return 'planned';
}

export function getPlannerTaskMeta(status?: PlannerTaskStatus | null): PlannerTaskMeta {
  return TASK_META[normalizePlannerTaskStatus(status)];
}

export function isPlannerTaskCompleted(taskState?: PlannerTaskState | null): boolean {
  return normalizePlannerTaskStatus(taskState?.status) === 'completed';
}

export function isPlannerTaskReadyToGo(taskState?: PlannerTaskState | null): boolean {
  const s = normalizePlannerTaskStatus(taskState?.status);
  return s === 'booked' || s === 'executed';
}

export function getPlannerTaskCounts(
  taskState: PlannerTaskState | null | undefined,
  totalActivities: number
) {
  const selectedCount = taskState?.selectedActivityIds?.length || 0;
  const bookedCount = taskState?.bookedActivityIds?.length || 0;
  const completedCount = taskState?.completedActivityIds?.length || 0;
  return {
    selectedCount,
    bookedCount,
    completedCount,
    totalActivities,
  };
}

export function getPlannerTaskProgressText(
  taskState: PlannerTaskState | null | undefined,
  totalActivities: number
): string {
  const status = normalizePlannerTaskStatus(taskState?.status);
  const { selectedCount, bookedCount, completedCount } = getPlannerTaskCounts(
    taskState,
    totalActivities
  );

  if (status === 'completed') {
    return `已完成 ${Math.max(completedCount, totalActivities || completedCount)} / ${Math.max(totalActivities, completedCount)} 项`;
  }

  if (status === 'executed') {
    return `已执行 ${Math.max(completedCount, totalActivities || completedCount)} / ${Math.max(totalActivities, completedCount)} 项`;
  }

  if (status === 'booked') {
    return bookedCount > 0
      ? `已预订 ${bookedCount} / ${Math.max(totalActivities, bookedCount)} 项`
      : `${totalActivities} 个地点`;
  }

  if (status === 'selected') {
    return selectedCount > 0
      ? `已挑选 ${selectedCount} / ${Math.max(totalActivities, selectedCount)} 项`
      : `${totalActivities} 个地点`;
  }

  return totalActivities > 0 ? `${totalActivities} 个地点待挑选` : '待补充活动';
}
