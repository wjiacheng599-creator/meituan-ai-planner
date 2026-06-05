import type {
  RouteSegment,
  TravelMode,
  TaxiDispatchRecommendation,
  ExecutionRunRecord,
} from '../types';
import type { Plan, Activity } from '../services/ai';
import type { ExecutionPlan } from '../services/tools';
import type { AgentResult } from '../services/agent';
import { estimateTaxiDispatch } from '../services/apiAdapter';
import type { RouteMapData } from '../components/itinerary/types';

export const CITY_CENTERS: Record<string, { lng: number; lat: number }> = {
  北京: { lng: 116.404, lat: 39.915 },
  上海: { lng: 121.473, lat: 31.23 },
  成都: { lng: 104.065, lat: 30.659 },
  深圳: { lng: 114.057, lat: 22.543 },
  广州: { lng: 113.264, lat: 23.129 },
  杭州: { lng: 120.153, lat: 30.287 },
  重庆: { lng: 106.551, lat: 29.563 },
  武汉: { lng: 114.305, lat: 30.592 },
  西安: { lng: 108.939, lat: 34.341 },
  南京: { lng: 118.796, lat: 32.059 },
};

export function formatMeters(distance: number): string {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export function formatMoney(value?: number): string {
  if (!value || value <= 0) return '约 ¥0';
  return `约 ¥${Math.round(value)}`;
}

export function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toFiniteCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatStepCount(distance: number): string {
  return `约 ${Math.round(distance * 1.3)} 步`;
}

export function pathToPolyline(path: [number, number][] | undefined): string | undefined {
  if (!path || path.length < 2) return undefined;
  return path.map(([lng, lat]) => `${lng},${lat}`).join(';');
}

export function polylinePointCount(polyline?: string): number {
  if (!polyline) return 0;
  return polyline
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export function routeSegmentPolylineScore(segment?: { polyline?: string } | null): number {
  return polylinePointCount(segment?.polyline);
}

export function routePolylineQualityScore(segments?: Array<{ polyline?: string } | null>): number {
  return (segments || []).reduce((sum, segment) => {
    const pointCount = polylinePointCount(segment?.polyline);
    return sum + Math.max(0, pointCount - 2);
  }, 0);
}

export function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export function createEmptyModeMap<T>(factory: () => T): Record<TravelMode, T> {
  return {
    driving: factory(),
    taxi: factory(),
    transit: factory(),
    cycling: factory(),
    walking: factory(),
  };
}

export function buildFallbackSegments(
  points: RouteMapData['points'],
  mode: TravelMode
): RouteSegment[] {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const dx = (next.location.lng - point.location.lng) * 85000;
    const dy = (next.location.lat - point.location.lat) * 111000;
    const straightDistance = Math.max(400, Math.round(Math.sqrt(dx * dx + dy * dy)));

    const duration =
      mode === 'walking'
        ? Math.max(8, Math.round(straightDistance / 75))
        : mode === 'cycling'
          ? Math.max(5, Math.round(straightDistance / 230))
          : mode === 'transit'
            ? Math.max(10, Math.round(straightDistance / 240) + 8)
            : Math.max(6, Math.round(straightDistance / 420));

    const startLng = point.location.lng;
    const startLat = point.location.lat;
    const endLng = next.location.lng;
    const endLat = next.location.lat;
    const midLng = (startLng + endLng) / 2;
    const midLat = (startLat + endLat) / 2;
    const perpX = -(endLat - startLat) * 0.15;
    const perpY = (endLng - startLng) * 0.15;
    const arcPoints: string[] = [];
    const arcSteps = 8;
    for (let i = 0; i <= arcSteps; i++) {
      const t = i / arcSteps;
      const baseLng = startLng + (endLng - startLng) * t;
      const baseLat = startLat + (endLat - startLat) * t;
      const bulge = Math.sin(t * Math.PI);
      arcPoints.push(`${baseLng + perpX * bulge},${baseLat + perpY * bulge}`);
    }
    const fallbackPolyline = arcPoints.join(';');

    const baseSegment: RouteSegment = {
      from: { name: point.title, lat: point.location.lat, lng: point.location.lng },
      to: { name: next.title, lat: next.location.lat, lng: next.location.lng },
      mode,
      distance: straightDistance,
      duration,
      steps: [],
      cost: 0,
      polyline: fallbackPolyline,
    };

    if (mode === 'transit') {
      return {
        ...baseSegment,
        transfers: straightDistance > 4500 ? 1 : 0,
        walkingDistance: Math.round(straightDistance * 0.18),
        cost: Math.max(2, Math.round(straightDistance / 5000) * 2),
        steps: ['站点衔接中', '已为你整理可用公共交通路径'],
      };
    }
    if (mode === 'cycling') {
      return { ...baseSegment, steps: ['更适合近距离串点', '骑行节奏自由'] };
    }
    if (mode === 'walking') {
      return { ...baseSegment, steps: ['适合慢逛', formatStepCount(straightDistance)] };
    }
    if (mode === 'taxi') {
      const taxi = estimateTaxiDispatch({
        peopleCount: 1,
        hasChild: false,
        hasElder: false,
        comfortPreferred: false,
        budgetSensitive: false,
        distanceMeters: straightDistance,
        durationMinutes: duration,
      });
      return {
        ...baseSegment,
        duration: duration + taxi.estimatedWaitMinutes,
        cost: taxi.estimatedFare,
        taxi,
        steps: [`预计 ${taxi.estimatedWaitMinutes} 分钟上车`, taxi.tierLabel],
      };
    }
    return { ...baseSegment, steps: ['连续跑点更顺', '适合高效切换'] };
  });
}

export function getModeRecommendationCopy(
  mode: TravelMode,
  params: {
    duration: number;
    distance: number;
    cost?: number;
    taxi?: TaxiDispatchRecommendation | null;
    transfers?: number;
  }
): { title: string; detail: string } {
  const { duration, distance, cost, taxi, transfers } = params;
  switch (mode) {
    case 'taxi':
      return {
        title: taxi?.tierLabel || '打车更省体力',
        detail: `${taxi?.estimatedWaitMinutes || 3} 分钟可上车 · ${formatMoney(cost)}`,
      };
    case 'driving':
      return {
        title: duration <= 25 ? '这条最快' : '顺路效率更高',
        detail: `${formatMeters(distance)} · 适合连续跑点`,
      };
    case 'transit':
      return {
        title: transfers && transfers > 1 ? `${transfers} 次换乘` : '更稳更省',
        detail: `${formatMoney(cost)} · 通勤感最强`,
      };
    case 'cycling':
      return {
        title: distance <= 5000 ? '近距离最舒服' : '适合轻运动',
        detail: `${formatMeters(distance)} · 节奏自由`,
      };
    case 'walking':
    default:
      return {
        title: distance <= 2500 ? '最适合 citywalk' : '自由但更费脚力',
        detail: `${formatMeters(distance)} · 无额外花费`,
      };
  }
}

export function getModeToneLabel(
  mode: TravelMode,
  params: {
    peopleCount: number;
    hasChild: boolean;
    hasElder: boolean;
    distance: number;
    duration: number;
    transfers?: number;
  }
): string {
  const { peopleCount, hasChild, hasElder, distance, duration, transfers } = params;
  switch (mode) {
    case 'taxi':
      return hasChild || hasElder ? '省体力' : peopleCount >= 3 ? '多人友好' : '更轻松';
    case 'driving':
      return duration <= 30 ? '效率高' : '更顺路';
    case 'transit':
      return transfers && transfers > 1 ? '更稳' : '最省钱';
    case 'cycling':
      return distance <= 5000 ? '节奏好' : '轻运动';
    case 'walking':
    default:
      return distance <= 2500 ? '适合漫游' : '更自由';
  }
}

export function getReadinessMeta(readiness?: Plan['executionReadiness']) {
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

export function buildToolLabel(toolName?: string, toolArgs?: Record<string, unknown>): string {
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

export function buildToolIconName(toolName?: string): string {
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

export function deriveFailedActivityIds(
  activities: Activity[],
  currentExecutionPlan: ExecutionPlan | null,
  result: AgentResult | null
) {
  const failedNames = new Set<string>();
  currentExecutionPlan?.calls.forEach((call) => {
    if (call.status === 'failed' && typeof call.input?.name === 'string')
      failedNames.add(call.input.name);
  });
  result?.steps.forEach((step) => {
    if (
      step.type === 'tool_result' &&
      step.status === 'failed' &&
      typeof step.toolArgs?.name === 'string'
    )
      failedNames.add(step.toolArgs.name);
  });
  return activities
    .filter((activity) => failedNames.has(activity.title))
    .map((activity) => activity.id);
}

export type ExecutionRunStatus = 'idle' | 'running' | 'completed' | 'partial_failed' | 'cancelled';

export interface ExecutionRun {
  id: string;
  planId?: string;
  planTitle: string;
  status: ExecutionRunStatus;
  startedAt: number;
  completedAt?: number;
  total: number;
  successCount: number;
  failCount: number;
  pendingCount: number;
  answer?: string;
  calls: ExecutionPlan['calls'];
}

export function createExecutionRun(
  executionPlan: ExecutionPlan,
  params: {
    planId?: string;
    status?: ExecutionRunStatus;
    answer?: string;
    startedAt?: number;
    completedAt?: number;
  } = {}
): ExecutionRun {
  const successCount = executionPlan.calls.filter((call) => call.status === 'success').length;
  const failCount = executionPlan.calls.filter((call) => call.status === 'failed').length;
  const pendingCount = executionPlan.calls.filter(
    (call) => call.status === 'pending' || call.status === 'running'
  ).length;
  const status =
    params.status ||
    (executionPlan.status === 'completed'
      ? 'completed'
      : executionPlan.status === 'partial_failed'
        ? 'partial_failed'
        : executionPlan.status === 'running'
          ? 'running'
          : 'idle');

  return {
    id: executionPlan.id,
    planId: params.planId,
    planTitle: executionPlan.planTitle,
    status,
    startedAt: params.startedAt || Date.now(),
    completedAt: params.completedAt,
    total: executionPlan.calls.length,
    successCount,
    failCount,
    pendingCount,
    answer: params.answer,
    calls: executionPlan.calls,
  };
}

export function deriveFailedCallsFromResult(
  executionPlan: ExecutionPlan | null,
  result: AgentResult
): ExecutionPlan['calls'] {
  const resultFailedTargets = new Set<string>();
  result.steps.forEach((step) => {
    if (step.type !== 'tool_result' || step.status !== 'failed') return;
    const target =
      typeof step.toolArgs?.name === 'string'
        ? step.toolArgs.name
        : typeof step.toolArgs?.to === 'string'
          ? step.toolArgs.to
          : '';
    if (target) resultFailedTargets.add(target);
  });

  return (executionPlan?.calls || []).filter((call) => {
    if (call.status === 'failed') return true;
    const target =
      typeof call.input?.name === 'string'
        ? call.input.name
        : typeof call.input?.to === 'string'
          ? call.input.to
          : '';
    return target ? resultFailedTargets.has(target) : false;
  });
}

export function toExecutionRunRecord(run: ExecutionRun): ExecutionRunRecord {
  return {
    id: run.id,
    planId: run.planId,
    planTitle: run.planTitle,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    total: run.total,
    successCount: run.successCount,
    failCount: run.failCount,
    pendingCount: run.pendingCount,
    answer: run.answer,
    calls: run.calls.map((call) => ({
      id: call.id,
      tool: call.tool,
      label: call.label,
      status: call.status,
      input: call.input,
      message: call.result?.message,
      error: call.error,
      startedAt: call.startedAt,
      finishedAt: call.finishedAt,
    })),
  };
}
