import { TravelMode } from '../types';
import type { RoutePlanningResult } from '../services/routePlanning';

interface RouteComparison {
  mode: TravelMode;
  totalTime: number;
  totalDistance: number;
  isFastest: boolean;
  isCheapest: boolean;
  isShortest: boolean;
  tag: string;
}

export function analyzeRoutes(
  routes: Record<string, RoutePlanningResult | undefined>
): RouteComparison[] {
  const comparisons: RouteComparison[] = [];

  Object.entries(routes).forEach(([mode, route]) => {
    if (route) {
      comparisons.push({
        mode: mode as TravelMode,
        totalTime: route.totalTime,
        totalDistance: route.totalDistance,
        isFastest: false,
        isCheapest: false,
        isShortest: false,
        tag: '',
      });
    }
  });

  if (comparisons.length === 0) {
    return comparisons;
  }

  // 按时间排序
  const sortedByTime = [...comparisons].sort((a, b) => a.totalTime - b.totalTime);
  if (sortedByTime[0]) {
    sortedByTime[0].isFastest = true;
  }

  // 按距离排序
  const sortedByDistance = [...comparisons].sort((a, b) => a.totalDistance - b.totalDistance);
  if (sortedByDistance[0]) {
    sortedByDistance[0].isShortest = true;
  }

  // 估算成本并找出最省的
  const withCostEstimate = comparisons.map((c) => ({
    ...c,
    estimatedCost: estimateCost(c.mode, c.totalDistance),
  }));

  const sortedByCost = [...withCostEstimate].sort((a, b) => a.estimatedCost - b.estimatedCost);
  const cheapestIndex = comparisons.findIndex((c) => c.mode === sortedByCost[0]?.mode);
  if (cheapestIndex !== -1) {
    comparisons[cheapestIndex].isCheapest = true;
  }

  // 生成标签
  comparisons.forEach((c) => {
    const tags: string[] = [];
    if (c.isFastest) tags.push('最快');
    if (c.isCheapest) tags.push('最省');
    if (c.isShortest) tags.push('最短');

    if (tags.length === 0) {
      tags.push(getModeDefaultTag(c.mode));
    }

    c.tag = tags.join(' · ');
  });

  return comparisons;
}

function getModeDefaultTag(mode: TravelMode): string {
  const tagMap: Record<TravelMode, string> = {
    driving: '推荐',
    taxi: '舒适',
    transit: '实惠',
    cycling: '环保',
    walking: '健康',
  };
  return tagMap[mode] || '推荐';
}

function estimateCost(mode: TravelMode, distanceMeters: number): number {
  const distanceKm = distanceMeters / 1000;

  switch (mode) {
    case 'taxi':
      return 13 + distanceKm * 2.5; // 起步价+里程费
    case 'driving':
      return distanceKm * 0.8; // 油费估算
    case 'transit':
      return Math.max(2, Math.ceil(distanceKm / 5) * 2); // 公交费
    case 'cycling':
    case 'walking':
      return 0;
    default:
      return distanceKm * 1.5;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${remainingMinutes}分钟`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  }
  return `${(meters / 1000).toFixed(1)}公里`;
}
