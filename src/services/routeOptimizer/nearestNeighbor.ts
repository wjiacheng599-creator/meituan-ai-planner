import { LocationPoint, calculateHaversineDistance } from './utils';

export interface NearestNeighborOptions {
  startPointIndex?: number;
}

export function nearestNeighbor(
  points: LocationPoint[],
  options: NearestNeighborOptions = {}
): LocationPoint[] {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [...points];
  }

  const { startPointIndex = 0 } = options;

  if (startPointIndex < 0 || startPointIndex >= points.length) {
    throw new Error('startPointIndex must be within the range of the points array');
  }

  const visited = new Set<number>();
  const optimizedRoute: LocationPoint[] = [];

  let currentIndex = startPointIndex;
  visited.add(currentIndex);
  optimizedRoute.push(points[currentIndex]);

  while (visited.size < points.length) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) {
        continue;
      }

      const distance = calculateHaversineDistance(points[currentIndex], points[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    if (nearestIndex === -1) {
      break;
    }

    visited.add(nearestIndex);
    optimizedRoute.push(points[nearestIndex]);
    currentIndex = nearestIndex;
  }

  return optimizedRoute;
}
