import { useState, useCallback, useRef } from 'react';
import { TravelMode } from '../types';
import { routePlanningManager } from '../services/routePlanningManager';
import { RoutePlanningResult } from '../services/routePlanning';

interface MultiRouteState {
  activeMode: TravelMode;
  routes: Record<string, RoutePlanningResult>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  isAllLoaded: boolean;
}

export function useMultiRoutePlanning(initialMode: TravelMode = 'driving') {
  const [state, setState] = useState<MultiRouteState>({
    activeMode: initialMode,
    routes: {},
    loading: {},
    errors: {},
    isAllLoaded: false,
  });

  const managerRef = useRef(routePlanningManager);

  const planAllRoutes = useCallback(
    async (points: Array<{ lng: number; lat: number }>, city?: string) => {
      setState((prev) => {
        const newLoading: Record<string, boolean> = {};
        const newErrors: Record<string, string | null> = {};

        Object.keys(prev.routes).forEach((mode) => {
          newLoading[mode] = true;
          newErrors[mode] = null;
        });

        return {
          ...prev,
          loading: newLoading,
          errors: newErrors,
          isAllLoaded: false,
        };
      });

      try {
        await managerRef.current.planAllModes(points, city);
        syncStateFromManager();
      } catch (error) {
        console.error('路线规划失败:', error);
      }
    },
    []
  );

  const syncStateFromManager = useCallback(() => {
    const manager = managerRef.current;
    const allRoutes = manager.getAllRoutes();
    const allLoading = manager.getAllLoadingStates();
    const allErrors = manager.getAllErrorStates();

    const routes: Record<string, RoutePlanningResult> = {};
    const loading: Record<string, boolean> = {};
    const errors: Record<string, string | null> = {};

    allRoutes.forEach((route, mode) => {
      routes[mode] = route;
    });

    allLoading.forEach((isLoading, mode) => {
      loading[mode] = isLoading;
    });

    allErrors.forEach((error, mode) => {
      if (error) {
        errors[mode] = error;
      }
    });

    const isAllLoaded = Array.from(allLoading.values()).every((v) => !v);

    setState((prev) => ({
      ...prev,
      routes,
      loading,
      errors,
      isAllLoaded,
    }));
  }, []);

  const setActiveMode = useCallback((mode: TravelMode) => {
    setState((prev) => ({
      ...prev,
      activeMode: mode,
    }));
  }, []);

  const getActiveRoute = useCallback(() => {
    return state.routes[state.activeMode] || null;
  }, [state.routes, state.activeMode]);

  const clearCache = useCallback(() => {
    managerRef.current.clearCache();
    setState({
      activeMode: initialMode,
      routes: {},
      loading: {},
      errors: {},
      isAllLoaded: false,
    });
  }, [initialMode]);

  return {
    state,
    planAllRoutes,
    setActiveMode,
    getActiveRoute,
    clearCache,
    manager: managerRef.current,
  };
}
