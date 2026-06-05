/**
 * 路线优化工具函数
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface LocationPoint {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
}

export type TimePeriod = 'morning' | 'forenoon' | 'noon' | 'afternoon' | 'evening';

export interface RouteSegment {
  from: LocationPoint;
  to: LocationPoint;
  distance: number;
}

/**
 * 使用 Haversine 公式计算两个经纬度点之间的距离（单位：米）
 * @param point1 第一个点的坐标
 * @param point2 第二个点的坐标
 * @returns 两点之间的距离（米）
 */
export function calculateHaversineDistance(point1: Coordinate, point2: Coordinate): number {
  const R = 6371000; // 地球半径（米）
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 从时间范围字符串中提取时段
 * @param timeLine 时间范围字符串，格式如 "09:00-11:00"
 * @returns 时段类型：早晨、上午、中午、下午、晚上
 */
export function parseTimePeriod(timeLine: string): TimePeriod {
  const match = timeLine.match(/^(\d{2}):\d{2}/);
  if (!match) {
    return 'forenoon'; // 默认返回上午
  }

  const hour = parseInt(match[1], 10);

  if (hour >= 5 && hour < 8) {
    return 'morning'; // 早晨：5:00-8:00
  } else if (hour >= 8 && hour < 12) {
    return 'forenoon'; // 上午：8:00-12:00
  } else if (hour >= 12 && hour < 14) {
    return 'noon'; // 中午：12:00-14:00
  } else if (hour >= 14 && hour < 18) {
    return 'afternoon'; // 下午：14:00-18:00
  } else {
    return 'evening'; // 晚上：18:00-5:00
  }
}

/**
 * 计算路线的总距离
 * @param points 路线上的点序列
 * @returns 总距离（米）
 */
export function calculateTotalRouteDistance(points: LocationPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += calculateHaversineDistance(points[i], points[i + 1]);
  }

  return totalDistance;
}

/**
 * 获取时段的中文描述
 * @param period 时段类型
 * @returns 中文描述
 */
export function getTimePeriodLabel(period: TimePeriod): string {
  const labels: Record<TimePeriod, string> = {
    morning: '早晨',
    forenoon: '上午',
    noon: '中午',
    afternoon: '下午',
    evening: '晚上',
  };
  return labels[period] || '未知';
}
