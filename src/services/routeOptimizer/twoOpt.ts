/**
 * 2-opt 算法实现
 * 用于优化现有路线的局部优化算法
 */

import { LocationPoint, calculateTotalRouteDistance } from './utils';

export interface TwoOptOptions {
  maxIterations?: number;
}

/**
 * 使用 2-opt 算法优化路线
 * 通过交换两条边来减少总距离
 * @param points 路线上的点序列
 * @param options 配置选项
 * @returns 优化后的路线
 */
export function twoOpt(points: LocationPoint[], options: TwoOptOptions = {}): LocationPoint[] {
  if (points.length < 3) {
    return [...points];
  }

  const { maxIterations = 100 } = options;
  let optimizedRoute = [...points];
  let bestDistance = calculateTotalRouteDistance(optimizedRoute);
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (let i = 1; i < optimizedRoute.length - 2; i++) {
      for (let k = i + 1; k < optimizedRoute.length - 1; k++) {
        const newRoute = twoOptSwap(optimizedRoute, i, k);
        const newDistance = calculateTotalRouteDistance(newRoute);

        if (newDistance < bestDistance) {
          optimizedRoute = newRoute;
          bestDistance = newDistance;
          improved = true;
          break;
        }
      }

      if (improved) {
        break;
      }
    }
  }

  return optimizedRoute;
}

/**
 * 执行 2-opt 交换操作
 * 反转 i 到 k 之间的路径片段
 * @param route 原始路线
 * @param i 起始索引
 * @param k 结束索引
 * @returns 交换后的路线
 */
function twoOptSwap(route: LocationPoint[], i: number, k: number): LocationPoint[] {
  const newRoute = [...route];
  const segment = newRoute.slice(i, k + 1).reverse();
  newRoute.splice(i, k - i + 1, ...segment);
  return newRoute;
}
