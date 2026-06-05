import type { TravelMode } from '../types';
import type { RouteSegment } from '../types';
import { loadAmapScript, loadRoutePlugins } from './amapWeb';

export interface TransitSegmentDetail {
  lineName: string;
  lineType: string;
  stationCount: number;
  startStation: string;
  endStation: string;
  viaStations?: string[];
}

export interface RouteSegmentResult {
  mode: TravelMode;
  path?: [number, number][];
  distance: number;
  time: number;
  /** 导航指示 */
  instruction: string;
  /** 公交详途信息 */
  transitDetails?: TransitSegmentDetail[];
  steps?: string[];
  transfers?: number;
  walkingDistance?: number;
  /** 辅助字段别名（由路线规划填充） */
  duration?: number;
  from?: { name: string; lat: number; lng: number };
  to?: { name: string; lat: number; lng: number };
}

export interface RoutePlanningResult {
  totalTime: number;
  totalDistance: number;
  segments: RouteSegmentResult[];
  /** 全局路线折线（AMap 驾车结果有此字段） */
  path?: [number, number][];
}

interface AMapInstance {
  remove(target: unknown): void;
  add(target: unknown): void;
  setFitView(overlays?: unknown[], immediately?: boolean, padding?: number[]): void;
}

interface AMapStatic {
  Driving: new (options: Record<string, unknown>) => {
    search(
      start: [number, number] | string,
      end: [number, number] | string,
      callback: (status: string, result: DrivingResult) => void
    ): void;
    clear(): void;
  };
  Transfer: new (options: Record<string, unknown>) => {
    search(
      start: [number, number] | string,
      end: [number, number] | string,
      callback: (status: string, result: TransferResult) => void
    ): void;
    clear(): void;
  };
  Walking: new (options: Record<string, unknown>) => {
    search(
      start: [number, number] | string,
      end: [number, number] | string,
      callback: (status: string, result: WalkingResult) => void
    ): void;
    clear(): void;
  };
  Riding: new (options: Record<string, unknown>) => {
    search(
      start: [number, number] | string,
      end: [number, number] | string,
      callback: (status: string, result: RidingResult) => void
    ): void;
    clear(): void;
  };
}

interface DrivingResult {
  info: string;
  result?: {
    routes?: DrivingPath[];
    start?: { lat: number; lng: number };
    end?: { lat: number; lng: number };
  };
  routes?: DrivingPath[];
  origin?: string;
  destination?: string;
}

interface DrivingPath {
  distance: number;
  time: number;
  steps: DrivingStep[];
  strategy: string;
}

interface DrivingStep {
  instruction: string;
  road: string;
  distance: number;
  time: number;
  path: unknown;
}

interface TransferResult {
  info: string;
  result?: TransferPlan;
  routes?: TransferRoute[];
}

interface TransferPlan {
  orgin: [number, number];
  destination: [number, number];
  taxi: TransferTaxi;
  routes: TransferRoute[];
}

interface TransferTaxi {
  distance: number;
  duration: number;
  tolls: number;
  taximeter: string;
}

interface TransferRoute {
  distance: number;
  duration: number;
  segments: TransferSegment[];
}

interface TransferSegment {
  walking?: TransferWalking;
  transit: TransferTransit | null;
}

interface TransferWalking {
  distance: number;
  duration: number;
  steps: WalkingStep[];
  path: unknown;
}

interface TransferTransit {
  line: TransferLine;
  departure_stop: TransferStop;
  arrival_stop: TransferStop;
  via_stops: TransferStop[];
  path?: unknown;
}

interface TransferLine {
  name: string;
  type: number;
}

interface TransferStop {
  name: string;
  location: [number, number];
}

interface WalkingStep {
  instruction: string;
  distance: number;
  time: number;
  path: unknown;
}

interface WalkingResult {
  info: string;
  result?: {
    routes?: WalkingPath[];
  };
  routes?: WalkingPath[];
}

interface WalkingPath {
  distance: number;
  time: number;
  steps: WalkingStep[];
  path: unknown;
}

interface RidingResult {
  info: string;
  result?: {
    routes?: RidingPath[];
  };
  routes?: RidingPath[];
}

interface RidingPath {
  distance: number;
  time: number;
  rides: RidingRide[];
}

interface RidingRide {
  instruction: string;
  distance: number;
  time: number;
  path: unknown;
}

export class RoutePlanningService {
  private AMap: AMapStatic | null = null;
  private isInitialized = false;
  private pluginsLoaded = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.AMap) {
      return true;
    }

    const AMap = await loadAmapScript();
    if (!AMap) {
      console.warn('[RoutePlanningService] AMap key not configured or script failed to load');
      return false;
    }

    this.AMap = AMap as unknown as AMapStatic;
    this.isInitialized = true;
    await this.loadPlugins();
    return true;
  }

  private async loadPlugins(): Promise<void> {
    if (this.pluginsLoaded) return;
    await loadRoutePlugins();
    this.pluginsLoaded = true;
  }

  private normalizePoint(point: unknown): [number, number] | null {
    if (Array.isArray(point) && point.length >= 2) {
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
    }

    if (point && typeof point === 'object') {
      const candidate = point as {
        lng?: unknown;
        lat?: unknown;
        getLng?: () => unknown;
        getLat?: () => unknown;
      };
      const lng =
        typeof candidate.getLng === 'function' ? Number(candidate.getLng()) : Number(candidate.lng);
      const lat =
        typeof candidate.getLat === 'function' ? Number(candidate.getLat()) : Number(candidate.lat);
      return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
    }

    return null;
  }

  parsePath(pathInput: unknown): [number, number][] {
    if (!pathInput) return [];

    if (typeof pathInput === 'string') {
      return pathInput
        .split(';')
        .map((coord) => {
          const [lng, lat] = coord.split(',').map(Number);
          return Number.isFinite(lng) && Number.isFinite(lat)
            ? ([lng, lat] as [number, number])
            : null;
        })
        .filter((point): point is [number, number] => point !== null);
    }

    if (Array.isArray(pathInput)) {
      return pathInput.flatMap((item) => {
        const normalized = this.normalizePoint(item);
        if (normalized) return [normalized];
        if (Array.isArray(item)) return this.parsePath(item);
        return [];
      });
    }

    const normalized = this.normalizePoint(pathInput);
    if (normalized) return [normalized];
    return [];
  }

  private appendPath(target: [number, number][], nextPath: [number, number][]) {
    if (nextPath.length === 0) return;
    if (target.length === 0) {
      target.push(...nextPath);
      return;
    }

    const [lastLng, lastLat] = target[target.length - 1];
    const [firstLng, firstLat] = nextPath[0];
    const samePoint = lastLng === firstLng && lastLat === firstLat;
    target.push(...(samePoint ? nextPath.slice(1) : nextPath));
  }

  async planRoute(
    points: { lng: number; lat: number }[],
    travelMode: TravelMode,
    city?: string
  ): Promise<RoutePlanningResult | null> {
    if (points.length < 2) {
      return null;
    }

    const initialized = await this.initialize();
    if (!initialized || !this.AMap) {
      return null;
    }

    const allSegments: RouteSegmentResult[] = [];
    let totalTime = 0;
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start: [number, number] = [points[i].lng, points[i].lat];
      const end: [number, number] = [points[i + 1].lng, points[i + 1].lat];

      const segment = await this.planSegment(start, end, travelMode, city);
      if (segment) {
        allSegments.push(segment);
        totalTime += segment.time;
        totalDistance += segment.distance;
      } else {
        // 降级方案：直线连接
        const fallbackSegment = this.createFallbackSegment(start, end, travelMode);
        allSegments.push(fallbackSegment);
        totalTime += fallbackSegment.time;
        totalDistance += fallbackSegment.distance;
      }
    }

    return {
      totalTime,
      totalDistance,
      segments: allSegments,
    };
  }

  private createFallbackSegment(
    start: [number, number],
    end: [number, number],
    mode: TravelMode
  ): RouteSegmentResult {
    const dx = (end[0] - start[0]) * 111000 * Math.cos((start[1] * Math.PI) / 180);
    const dy = (end[1] - start[1]) * 111000;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let time = 60; // 默认1分钟
    let instruction = '直线路线';

    if (mode === 'walking') {
      time = Math.max(1, Math.ceil(distance / 60)); // 60米/分钟
      instruction = '步行';
    } else if (mode === 'cycling') {
      time = Math.max(1, Math.ceil(distance / 200)); // 200米/分钟
      instruction = '骑行';
    } else if (mode === 'driving' || mode === 'taxi') {
      time = Math.max(1, Math.ceil(distance / 400)); // 400米/分钟
      instruction = '驾车';
    } else if (mode === 'transit') {
      time = Math.max(1, Math.ceil(distance / 300)); // 300米/分钟
      instruction = '公交';
    }

    return {
      mode,
      path: [start, end],
      distance: Math.max(100, distance),
      time,
      instruction,
    };
  }

  private async planSegment(
    start: [number, number],
    end: [number, number],
    travelMode: TravelMode,
    city?: string
  ): Promise<RouteSegmentResult | null> {
    if (!this.AMap) {
      return null;
    }

    try {
      await this.loadPlugins();
    } catch (e) {
      console.warn('[RoutePlanning] loadPlugins failed:', e);
      return null;
    }

    // 添加超时保护，防止 AMap 回调永不触发
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 15000);
    });

    const planPromise = (async () => {
      switch (travelMode) {
        case 'driving':
        case 'taxi':
          return this.planDrivingSegment(start, end);
        case 'transit':
          return this.planTransitSegment(start, end, city);
        case 'walking':
          return this.planWalkingSegment(start, end);
        case 'cycling':
          return this.planRidingSegment(start, end);
        default:
          return this.planDrivingSegment(start, end);
      }
    })();

    return Promise.race([planPromise, timeoutPromise]);
  }

  private planDrivingSegment(
    start: [number, number],
    end: [number, number]
  ): Promise<RouteSegmentResult | null> {
    return new Promise((resolve) => {
      if (!this.AMap || !this.AMap.Driving) {
        resolve(null);
        return;
      }

      const driving = new this.AMap.Driving({
        map: null,
        panel: null,
        policy: 4,
      });

      driving.search(start, end, (status, result: DrivingResult) => {
        driving.clear();

        const routes = result?.result?.routes || result?.routes;
        if (status === 'complete' && routes && routes.length > 0) {
          const path = routes[0];
          const allPath = path.steps.map((step) => this.parsePath(step.path)).flat();
          if (allPath.length < 2) {
            resolve(null);
            return;
          }
          const instruction = path.steps[0]?.instruction || '沿当前道路行驶';
          const steps = path.steps.map((s) => s.instruction);

          resolve({
            mode: 'driving',
            path: allPath,
            distance: path.distance,
            time: Math.ceil(path.time / 60),
            instruction,
            steps,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  private planTransitSegment(
    start: [number, number],
    end: [number, number],
    city?: string
  ): Promise<RouteSegmentResult | null> {
    return new Promise((resolve) => {
      if (!this.AMap || !this.AMap.Transfer) {
        resolve(null);
        return;
      }

      const transfer = new this.AMap.Transfer({
        map: null,
        panel: null,
        city: city || '成都市',
        policy: 4,
      });

      transfer.search(start, end, (status, result: TransferResult) => {
        transfer.clear();

        const routes = result?.result?.routes || result?.routes;
        if (status === 'complete' && routes && routes.length > 0) {
          const route = routes[0];
          let allPath: [number, number][] = [];
          let instruction = '';
          const transitDetails: TransitSegmentDetail[] = [];
          const allSteps: string[] = [];
          let walkingDistance = 0;

          route.segments.forEach((segment, index) => {
            if (segment.walking?.path) {
              const walkPath = this.parsePath(segment.walking.path);
              this.appendPath(allPath, walkPath);
              if (segment.walking.steps?.length > 0) {
                if (index === 0) {
                  instruction = `步行 ${Math.round(segment.walking.distance)} 米`;
                }
                segment.walking.steps.forEach((s) => allSteps.push(s.instruction));
              }
              walkingDistance += segment.walking.distance || 0;
            }

            if (segment.transit) {
              const line = segment.transit.line;
              const lineType = this.getLineTypeName(line.type);
              const lineName = line.name.replace(/\(.*?\)/g, '').trim();
              const transitPathFromStops = this.parsePath(segment.transit.path).length
                ? this.parsePath(segment.transit.path)
                : [
                    segment.transit.departure_stop.location,
                    ...(segment.transit.via_stops || []).map((stop) => stop.location),
                    segment.transit.arrival_stop.location,
                  ];
              this.appendPath(allPath, transitPathFromStops);

              const transitDetail: TransitSegmentDetail = {
                lineName,
                lineType,
                stationCount: segment.transit.via_stops?.length + 1 || 1,
                startStation: segment.transit.departure_stop.name,
                endStation: segment.transit.arrival_stop.name,
              };

              if (segment.transit.via_stops?.length) {
                transitDetail.viaStations = segment.transit.via_stops.map((s) => s.name);
              }

              transitDetails.push(transitDetail);

              const viaCount = segment.transit.via_stops?.length || 0;
              instruction = `乘坐 ${lineName} ${viaCount + 1} 站`;
            }
          });

          if (instruction === '' && route.segments.length > 0) {
            instruction = `换乘 ${route.segments.length} 段`;
          }

          if (allPath.length < 2) {
            resolve(null);
            return;
          }

          resolve({
            mode: 'transit',
            path: allPath,
            distance: route.distance,
            time: Math.ceil(route.duration / 60),
            instruction,
            transitDetails,
            steps: allSteps,
            transfers: Math.max(0, transitDetails.length - 1),
            walkingDistance,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  private getLineTypeName(type: number): string {
    const typeMap: Record<number, string> = {
      1: '地铁',
      2: '公交',
      3: '公交',
      4: '机场大巴',
      5: '长途客车',
      6: '火车',
      7: '飞机',
      8: '轮渡',
    };
    return typeMap[type] || '公交';
  }

  private planWalkingSegment(
    start: [number, number],
    end: [number, number]
  ): Promise<RouteSegmentResult | null> {
    return new Promise((resolve) => {
      if (!this.AMap || !this.AMap.Walking) {
        resolve(null);
        return;
      }

      const walking = new this.AMap.Walking({
        map: null,
        panel: null,
      });

      walking.search(start, end, (status, result: WalkingResult) => {
        walking.clear();

        const routes = result?.result?.routes || result?.routes;
        if (status === 'complete' && routes && routes.length > 0) {
          const path = routes[0];
          const allPath = path.steps.map((step) => this.parsePath(step.path)).flat();
          if (allPath.length < 2) {
            resolve(null);
            return;
          }
          const instruction = path.steps[0]?.instruction || '沿当前道路步行';
          const steps = path.steps.map((s) => s.instruction);

          resolve({
            mode: 'walking',
            path: allPath,
            distance: path.distance,
            time: Math.ceil(path.time / 60),
            instruction,
            steps,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  private planRidingSegment(
    start: [number, number],
    end: [number, number]
  ): Promise<RouteSegmentResult | null> {
    return new Promise((resolve) => {
      if (!this.AMap || !this.AMap.Riding) {
        console.warn(
          '[RoutePlanning] AMap.Riding not available, AMap:',
          !!this.AMap,
          'Riding:',
          !!this.AMap?.Riding
        );
        resolve(null);
        return;
      }

      const riding = new this.AMap.Riding({
        map: null,
        panel: null,
      });

      riding.search(start, end, (status, result: RidingResult) => {
        riding.clear();

        console.warn(
          '[RoutePlanning] Riding callback:',
          status,
          'result keys:',
          result ? Object.keys(result) : 'null',
          'routes:',
          result?.result?.routes?.length ?? result?.routes?.length
        );
        const routes = result?.result?.routes || result?.routes;
        if (status === 'complete' && routes && routes.length > 0) {
          const route = routes[0];
          const allPath = (route.rides || []).flatMap((ride) => this.parsePath(ride.path));
          if (allPath.length < 2) {
            resolve(null);
            return;
          }
          const firstRide = route.rides?.[0];
          const instruction = firstRide?.instruction || '沿当前道路骑行';
          const steps = (route.rides || []).map((r) => r.instruction).filter(Boolean);

          resolve({
            mode: 'cycling',
            path: allPath,
            distance: route.distance,
            time: Math.ceil(route.time / 60),
            instruction,
            steps,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  convertToRouteSegment(
    result: RoutePlanningResult,
    points: { lng: number; lat: number }[]
  ): RouteSegment[] {
    return result.segments.map((segment, index) => {
      const startPoint = points[index];
      const endPoint = points[index + 1];

      const routeSegment: RouteSegment = {
        id: `segment-${index}`,
        startActivityId: '',
        endActivityId: '',
        from: { name: '', lat: startPoint?.lat || 0, lng: startPoint?.lng || 0 },
        to: { name: '', lat: endPoint?.lat || 0, lng: endPoint?.lng || 0 },
        mode: segment.mode,
        distance: segment.distance,
        duration: segment.time,
        instruction: segment.instruction,
      };

      if (segment.mode === 'transit' && segment.transitDetails) {
        routeSegment.transitDetails = segment.transitDetails.map((detail) => ({
          lineName: detail.lineName,
          lineType: detail.lineType,
          stationCount: detail.stationCount,
          startStation: detail.startStation,
          endStation: detail.endStation,
          viaStations: detail.viaStations,
        }));
      }

      if (segment.mode === 'transit') {
        routeSegment.transfers = Math.max(0, (segment.transitDetails?.length || 1) - 1);
        routeSegment.walkingDistance = !!segment.path?.length
          ? Math.round(segment.distance * 0.1)
          : 0;
      }

      if (segment.steps) {
        routeSegment.steps = segment.steps;
      }

      return routeSegment;
    });
  }
}

export const routePlanningService = new RoutePlanningService();
