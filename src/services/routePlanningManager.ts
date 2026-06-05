import { TravelMode } from '../types';
import { routePlanningService, RoutePlanningResult } from './routePlanning';
import { TRAVEL_MODE_ORDER } from '../config/travelModes';

export class RoutePlanningManager {
  private cache: Map<TravelMode, RoutePlanningResult>;
  private loadingStates: Map<TravelMode, boolean>;
  private errorStates: Map<TravelMode, string | null>;

  constructor() {
    this.cache = new Map();
    this.loadingStates = new Map();
    this.errorStates = new Map();
  }

  async planAllModes(
    points: Array<{ lng: number; lat: number }>,
    city?: string
  ): Promise<Map<TravelMode, RoutePlanningResult>> {
    const results = new Map<TravelMode, RoutePlanningResult>();

    TRAVEL_MODE_ORDER.forEach((mode) => {
      this.loadingStates.set(mode, true);
      this.errorStates.set(mode, null);
    });

    const promises = TRAVEL_MODE_ORDER.map(async (mode) => {
      try {
        const result = await routePlanningService.planRoute(points, mode, city);
        if (result) {
          this.cache.set(mode, result);
          results.set(mode, result);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '路线规划失败';
        this.errorStates.set(mode, errorMessage);
      } finally {
        this.loadingStates.set(mode, false);
      }
    });

    await Promise.all(promises);
    return results;
  }

  getRoute(mode: TravelMode): RoutePlanningResult | null {
    return this.cache.get(mode) || null;
  }

  getAllRoutes(): Map<TravelMode, RoutePlanningResult> {
    return new Map(this.cache);
  }

  isCached(mode: TravelMode): boolean {
    return this.cache.has(mode);
  }

  isLoading(mode: TravelMode): boolean {
    return this.loadingStates.get(mode) || false;
  }

  getAllLoadingStates(): Map<TravelMode, boolean> {
    return new Map(this.loadingStates);
  }

  getError(mode: TravelMode): string | null {
    return this.errorStates.get(mode) || null;
  }

  getAllErrorStates(): Map<TravelMode, string | null> {
    return new Map(this.errorStates);
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingStates.clear();
    this.errorStates.clear();
  }
}

export const routePlanningManager = new RoutePlanningManager();
