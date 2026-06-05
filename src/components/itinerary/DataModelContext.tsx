import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import type { Plan, Activity } from '../../services/ai';
import type { TravelMode } from '../../types';
import type { RouteSegment } from '../../types';
import type { UIStrategy, ItineraryState, ItineraryAction } from './types';

function itineraryReducer(state: ItineraryState, action: ItineraryAction): ItineraryState {
  switch (action.type) {
    case 'SET_PLAN':
      return { ...state, plan: action.plan };
    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedIds);
      if (next.has(action.activityId)) {
        next.delete(action.activityId);
      } else {
        next.add(action.activityId);
      }
      return { ...state, selectedIds: next };
    }
    case 'SET_BOOKED': {
      const next = new Set(state.bookedIds);
      next.add(action.activityId);
      return { ...state, bookedIds: next };
    }
    case 'SET_TRAVEL_MODE':
      return { ...state, travelMode: action.mode };
    case 'SET_ROUTE_MAP':
      return { ...state, routeMap: action.routeMap };
    case 'SET_UI_STRATEGY':
      return { ...state, uiStrategy: action.uiStrategy };
    case 'RECORD_CHANGE':
      return {
        ...state,
        changeHistory: [
          ...state.changeHistory.slice(-49),
          { action: action.action, timestamp: Date.now(), detail: action.detail },
        ],
      };
    default:
      return state;
  }
}

function createInitialState(plan?: Plan): ItineraryState {
  return {
    plan: plan ?? null,
    selectedIds: new Set<string>(),
    bookedIds: new Set<string>(),
    travelMode: 'taxi',
    routeMap: null,
    uiStrategy: null,
    changeHistory: [],
  };
}

interface DataModelContextValue {
  state: ItineraryState;
  dispatch: React.Dispatch<ItineraryAction>;
  selectActivity: (id: string) => void;
  bookActivity: (id: string) => void;
  setTravelMode: (mode: TravelMode) => void;
  setRouteMap: (
    segments: RouteSegment[],
    totalDistance: number,
    totalDuration: number,
    totalCost: number
  ) => void;
  setPlan: (plan: Plan) => void;
  setUIStrategy: (uiStrategy: UIStrategy) => void;
  recordChange: (action: string, detail: string) => void;
  getSelectedActivities: () => Activity[];
  getChangeContext: () => string;
}

const DataModelContext = createContext<DataModelContextValue | null>(null);

export function DataModelProvider({
  children,
  initialPlan,
}: {
  children: React.ReactNode;
  initialPlan?: Plan;
}) {
  const [state, dispatch] = useReducer(itineraryReducer, initialPlan, createInitialState);
  const planRef = useRef(state.plan);
  planRef.current = state.plan;

  const selectActivity = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECT', activityId: id });
  }, []);

  const bookActivity = useCallback((id: string) => {
    dispatch({ type: 'SET_BOOKED', activityId: id });
  }, []);

  const setTravelMode = useCallback((mode: TravelMode) => {
    dispatch({ type: 'SET_TRAVEL_MODE', mode });
    dispatch({ type: 'RECORD_CHANGE', action: '切换出行方式', detail: mode });
  }, []);

  const setRouteMap = useCallback(
    (segments: RouteSegment[], totalDistance: number, totalDuration: number, totalCost: number) => {
      dispatch({
        type: 'SET_ROUTE_MAP',
        routeMap: { segments, totalDistance, totalDuration, totalCost },
      });
    },
    []
  );

  const setPlan = useCallback((plan: Plan) => {
    dispatch({ type: 'SET_PLAN', plan });
  }, []);

  const setUIStrategy = useCallback((uiStrategy: UIStrategy) => {
    dispatch({ type: 'SET_UI_STRATEGY', uiStrategy });
  }, []);

  const recordChange = useCallback((action: string, detail: string) => {
    dispatch({ type: 'RECORD_CHANGE', action, detail });
  }, []);

  const getSelectedActivities = useCallback((): Activity[] => {
    const plan = planRef.current;
    if (!plan) return [];
    return plan.activities.filter((a) => state.selectedIds.has(a.id));
  }, [state.selectedIds]);

  const getChangeContext = useCallback((): string => {
    if (state.changeHistory.length === 0) return '';
    return state.changeHistory.map((c) => `- ${c.action}: ${c.detail}`).join('\n');
  }, [state.changeHistory]);

  return (
    <DataModelContext.Provider
      value={{
        state,
        dispatch,
        selectActivity,
        bookActivity,
        setTravelMode,
        setRouteMap,
        setPlan,
        setUIStrategy,
        recordChange,
        getSelectedActivities,
        getChangeContext,
      }}
    >
      {children}
    </DataModelContext.Provider>
  );
}

export function useDataModel() {
  const ctx = useContext(DataModelContext);
  if (!ctx) {
    throw new Error('useDataModel must be used within DataModelProvider');
  }
  return ctx;
}
