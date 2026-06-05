/**
 * 路线优化器主入口
 * 整合多种优化算法，提供统一的优化接口
 */

import { nearestNeighbor, NearestNeighborOptions } from './nearestNeighbor';
import { twoOpt, TwoOptOptions } from './twoOpt';
import {
  checkAndFixTimeConstraints,
  ensureMealOrder,
  TimeConstrainedActivity,
  TimeConstraintResult,
} from './timeConstraints';
import {
  checkAndFixTypeConstraints,
  optimizeActivityTypeMix,
  TypeConstrainedActivity,
  TypeConstraintResult,
} from './typeConstraints';
import {
  LocationPoint,
  calculateTotalRouteDistance,
  Coordinate,
  TimePeriod,
  RouteSegment,
} from './utils';

export type OptimizationStrategy = 'distance' | 'time' | 'balanced';

export interface OptimizeRouteOptions {
  strategy?: OptimizationStrategy;
  nearestNeighborOptions?: NearestNeighborOptions;
  twoOptOptions?: TwoOptOptions;
  applyTimeConstraints?: boolean;
  applyTypeConstraints?: boolean;
}

export interface RouteOptimizationResult {
  originalRoute: LocationPoint[];
  optimizedRoute: LocationPoint[];
  originalDistance: number;
  optimizedDistance: number;
  distanceSaved: number;
  distanceSavedPercentage: number;
  strategy: OptimizationStrategy;
  timeConstraintResult?: TimeConstraintResult;
  typeConstraintResult?: TypeConstraintResult;
  optimizationSteps: string[];
}

export interface OptimizedActivity {
  id: string;
  timeLine: string;
  type: 'food' | 'activity' | 'travel' | 'shopping' | 'entertainment' | 'other';
  title: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

export function optimizeRoute(
  points: LocationPoint[],
  options: OptimizeRouteOptions = {}
): RouteOptimizationResult {
  const {
    strategy = 'balanced',
    nearestNeighborOptions = {},
    twoOptOptions = {},
    applyTimeConstraints = true,
    applyTypeConstraints = true,
  } = options;

  const optimizationSteps: string[] = [];

  if (points.length <= 1) {
    const distance = calculateTotalRouteDistance(points);
    return {
      originalRoute: [...points],
      optimizedRoute: [...points],
      originalDistance: distance,
      optimizedDistance: distance,
      distanceSaved: 0,
      distanceSavedPercentage: 0,
      strategy,
      optimizationSteps: ['点数量不足，无需优化'],
    };
  }

  const originalRoute = [...points];
  const originalDistance = calculateTotalRouteDistance(originalRoute);
  optimizationSteps.push(`原始路线距离: ${(originalDistance / 1000).toFixed(2)} km`);

  let optimizedRoute = [...points];

  switch (strategy) {
    case 'distance':
      optimizedRoute = nearestNeighbor(optimizedRoute, nearestNeighborOptions);
      optimizationSteps.push('应用最近邻算法（距离优先）');
      optimizedRoute = twoOpt(optimizedRoute, twoOptOptions);
      optimizationSteps.push('应用 2-opt 局部优化');
      break;
    case 'time':
      optimizedRoute = nearestNeighbor(optimizedRoute, nearestNeighborOptions);
      optimizationSteps.push('应用最近邻算法（时间优先）');
      break;
    case 'balanced':
    default:
      optimizedRoute = nearestNeighbor(optimizedRoute, nearestNeighborOptions);
      optimizationSteps.push('应用最近邻算法');
      optimizedRoute = twoOpt(optimizedRoute, twoOptOptions);
      optimizationSteps.push('应用 2-opt 局部优化');
      break;
  }

  const optimizedDistance = calculateTotalRouteDistance(optimizedRoute);
  const distanceSaved = originalDistance - optimizedDistance;
  const distanceSavedPercentage =
    originalDistance > 0 ? (distanceSaved / originalDistance) * 100 : 0;

  optimizationSteps.push(`优化后路线距离: ${(optimizedDistance / 1000).toFixed(2)} km`);
  optimizationSteps.push(
    `节省距离: ${(distanceSaved / 1000).toFixed(2)} km (${distanceSavedPercentage.toFixed(1)}%)`
  );

  return {
    originalRoute,
    optimizedRoute,
    originalDistance,
    optimizedDistance,
    distanceSaved,
    distanceSavedPercentage,
    strategy,
    optimizationSteps,
  };
}

export function optimizeActivitiesWithConstraints(
  activities: OptimizedActivity[],
  options: OptimizeRouteOptions = {}
): RouteOptimizationResult & {
  optimizedActivities: OptimizedActivity[];
} {
  const locationPoints: LocationPoint[] = activities.map((activity) => ({
    id: activity.id,
    name: activity.title,
    lat: activity.lat,
    lng: activity.lng,
  }));

  const routeResult = optimizeRoute(locationPoints, options);

  let optimizedActivities = [...activities];
  let timeConstraintResult: TimeConstraintResult | undefined;
  let typeConstraintResult: TypeConstraintResult | undefined;

  if (options.applyTimeConstraints) {
    timeConstraintResult = checkAndFixTimeConstraints(
      optimizedActivities as TimeConstrainedActivity[]
    );
    optimizedActivities = timeConstraintResult.optimizedActivities as OptimizedActivity[];
  }

  if (options.applyTypeConstraints) {
    typeConstraintResult = checkAndFixTypeConstraints(
      optimizedActivities as TypeConstrainedActivity[]
    );
    optimizedActivities = typeConstraintResult.optimizedActivities as OptimizedActivity[];
  }

  const optimizedLocationPoints: LocationPoint[] = optimizedActivities.map((activity) => ({
    id: activity.id,
    name: activity.title,
    lat: activity.lat,
    lng: activity.lng,
  }));

  return {
    ...routeResult,
    optimizedRoute: optimizedLocationPoints,
    timeConstraintResult,
    typeConstraintResult,
    optimizedActivities,
  };
}

export {
  nearestNeighbor,
  twoOpt,
  checkAndFixTimeConstraints,
  ensureMealOrder,
  checkAndFixTypeConstraints,
  optimizeActivityTypeMix,
  calculateTotalRouteDistance,
};

export type {
  NearestNeighborOptions,
  TwoOptOptions,
  TimeConstrainedActivity,
  TimeConstraintResult,
  TypeConstrainedActivity,
  TypeConstraintResult,
  LocationPoint,
  Coordinate,
  TimePeriod,
  RouteSegment,
};
