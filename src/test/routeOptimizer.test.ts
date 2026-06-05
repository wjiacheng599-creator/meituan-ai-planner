/**
 * routeOptimizer 核心算法单元测试
 * 覆盖：Haversine 距离计算、2-opt 算法、nearestNeighbor 算法、parseTimePeriod
 */
import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateTotalRouteDistance,
  parseTimePeriod,
  getTimePeriodLabel,
  type LocationPoint,
} from '../services/routeOptimizer/utils';
import { twoOpt } from '../services/routeOptimizer/twoOpt';
import { nearestNeighbor } from '../services/routeOptimizer/nearestNeighbor';

// ──────────────────────────────────────────────
// Haversine 距离计算
// ──────────────────────────────────────────────
describe('calculateHaversineDistance', () => {
  it('同一点距离为 0', () => {
    const p = { lat: 39.9042, lng: 116.4074 }; // 北京
    expect(calculateHaversineDistance(p, p)).toBe(0);
  });

  it('北京到上海大约 1065 km（±5%）', () => {
    const beijing = { lat: 39.9042, lng: 116.4074 };
    const shanghai = { lat: 31.2304, lng: 121.4737 };
    const dist = calculateHaversineDistance(beijing, shanghai);
    // 直线距离约 1065 km
    expect(dist).toBeGreaterThan(1_000_000);
    expect(dist).toBeLessThan(1_130_000);
  });

  it('距离是对称的', () => {
    const a = { lat: 39.9042, lng: 116.4074 };
    const b = { lat: 31.2304, lng: 121.4737 };
    expect(calculateHaversineDistance(a, b)).toBeCloseTo(calculateHaversineDistance(b, a), 0);
  });
});

// ──────────────────────────────────────────────
// calculateTotalRouteDistance
// ──────────────────────────────────────────────
describe('calculateTotalRouteDistance', () => {
  it('空路线返回 0', () => {
    expect(calculateTotalRouteDistance([])).toBe(0);
  });

  it('单点路线返回 0', () => {
    expect(calculateTotalRouteDistance([{ lat: 39.9, lng: 116.4 }])).toBe(0);
  });

  it('三点路线总距离 = 段1 + 段2', () => {
    const a: LocationPoint = { lat: 39.9, lng: 116.4 };
    const b: LocationPoint = { lat: 39.95, lng: 116.45 };
    const c: LocationPoint = { lat: 40.0, lng: 116.5 };
    const ab = calculateHaversineDistance(a, b);
    const bc = calculateHaversineDistance(b, c);
    expect(calculateTotalRouteDistance([a, b, c])).toBeCloseTo(ab + bc, 0);
  });
});

// ──────────────────────────────────────────────
// parseTimePeriod
// ──────────────────────────────────────────────
describe('parseTimePeriod', () => {
  const cases: [string, string][] = [
    ['06:00-08:00', 'morning'],
    ['09:00-11:00', 'forenoon'],
    ['12:30-13:30', 'noon'],
    ['14:00-17:00', 'afternoon'],
    ['19:00-21:00', 'evening'],
    ['invalid', 'forenoon'], // 默认上午
  ];

  it.each(cases)('"%s" → %s', (input, expected) => {
    expect(parseTimePeriod(input)).toBe(expected);
  });
});

// ──────────────────────────────────────────────
// getTimePeriodLabel
// ──────────────────────────────────────────────
describe('getTimePeriodLabel', () => {
  it('返回正确中文标签', () => {
    expect(getTimePeriodLabel('morning')).toBe('早晨');
    expect(getTimePeriodLabel('forenoon')).toBe('上午');
    expect(getTimePeriodLabel('noon')).toBe('中午');
    expect(getTimePeriodLabel('afternoon')).toBe('下午');
    expect(getTimePeriodLabel('evening')).toBe('晚上');
  });
});

// ──────────────────────────────────────────────
// nearestNeighbor 算法
// ──────────────────────────────────────────────
describe('nearestNeighbor', () => {
  it('空数组返回空数组', () => {
    expect(nearestNeighbor([])).toEqual([]);
  });

  it('单点返回单点', () => {
    const p: LocationPoint = { id: 'a', lat: 39.9, lng: 116.4 };
    expect(nearestNeighbor([p])).toEqual([p]);
  });

  it('返回与输入相同数量的点', () => {
    const points: LocationPoint[] = [
      { id: '1', lat: 39.9, lng: 116.4 },
      { id: '2', lat: 39.95, lng: 116.5 },
      { id: '3', lat: 40.0, lng: 116.3 },
      { id: '4', lat: 39.85, lng: 116.45 },
    ];
    expect(nearestNeighbor(points)).toHaveLength(points.length);
  });

  it('startPointIndex 超出范围抛出错误', () => {
    const points: LocationPoint[] = [
      { lat: 39.9, lng: 116.4 },
      { lat: 39.95, lng: 116.5 },
    ];
    expect(() => nearestNeighbor(points, { startPointIndex: 5 })).toThrow();
  });

  it('输出结果包含所有输入点（无重复、无遗漏）', () => {
    const points: LocationPoint[] = [
      { id: 'A', lat: 39.9, lng: 116.4 },
      { id: 'B', lat: 31.2, lng: 121.5 },
      { id: 'C', lat: 22.5, lng: 114.1 },
    ];
    const result = nearestNeighbor(points);
    const inputIds = points.map((p) => p.id).sort();
    const outputIds = result.map((p) => p.id).sort();
    expect(outputIds).toEqual(inputIds);
  });
});

// ──────────────────────────────────────────────
// 2-opt 算法
// ──────────────────────────────────────────────
describe('twoOpt', () => {
  it('少于 3 个点直接返回副本', () => {
    const points: LocationPoint[] = [
      { lat: 39.9, lng: 116.4 },
      { lat: 31.2, lng: 121.5 },
    ];
    const result = twoOpt(points);
    expect(result).toEqual(points);
    expect(result).not.toBe(points); // 确保是副本
  });

  it('优化后总距离不大于优化前', () => {
    // 故意给一个低效顺序：北京→广州→上海（绕路）
    const beijing: LocationPoint = { id: 'bj', lat: 39.9042, lng: 116.4074 };
    const guangzhou: LocationPoint = { id: 'gz', lat: 23.1291, lng: 113.2644 };
    const shanghai: LocationPoint = { id: 'sh', lat: 31.2304, lng: 121.4737 };
    const original = [beijing, guangzhou, shanghai];
    const optimized = twoOpt(original);
    const origDist = calculateTotalRouteDistance(original);
    const optDist = calculateTotalRouteDistance(optimized);
    expect(optDist).toBeLessThanOrEqual(origDist + 1); // 允许浮点精度
  });

  it('输出包含与输入相同的点集', () => {
    const points: LocationPoint[] = [
      { id: 'A', lat: 39.9, lng: 116.4 },
      { id: 'B', lat: 31.2, lng: 121.5 },
      { id: 'C', lat: 22.5, lng: 114.1 },
      { id: 'D', lat: 30.7, lng: 104.1 },
    ];
    const result = twoOpt(points);
    expect(result).toHaveLength(points.length);
    const inputIds = new Set(points.map((p) => p.id));
    result.forEach((p) => expect(inputIds.has(p.id)).toBe(true));
  });

  it('maxIterations=0 时不执行优化，返回原始顺序副本', () => {
    const points: LocationPoint[] = [
      { id: '1', lat: 39.9, lng: 116.4 },
      { id: '2', lat: 22.5, lng: 114.1 },
      { id: '3', lat: 31.2, lng: 121.5 },
    ];
    const result = twoOpt(points, { maxIterations: 0 });
    expect(result.map((p) => p.id)).toEqual(points.map((p) => p.id));
  });
});
