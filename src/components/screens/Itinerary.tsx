import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import type { Plan, Activity, CopilotMessage } from '../../services/ai';
import type { ExecutionPlan, ToolName } from '../../services/tools';
import { buildExecutionPlan, executePlan, findCallIndex } from '../../services/tools';
import type { AgentStep, AgentResult } from '../../services/agent';
import { agentExecute } from '../../services/agent';
import {
  estimateTaxiDispatch,
  planMultiPointRoute,
  searchSmartNearby,
  getUserLocation,
} from '../../services/apiAdapter';
import { useTravelMode } from '../../hooks/useTravelMode';
import type { RouteSegment, TravelMode, TaxiDispatchRecommendation } from '../../types';
import type { ExecutionRunRecord, PersonProfile } from '../../types';
import { useAppStore } from '../../store/appStore';
import { TRAVEL_MODE_ORDER } from '../../config/travelModes';
import { ChevronLeft, Share2, XCircle, CarTaxiFront, Check } from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';
import {
  routePlanningService,
  type RoutePlanningResult,
  type RouteSegmentResult,
} from '../../services/routePlanning';

import { learnFromActivity } from '../../services/userPreference';
import { useBehaviorTracking } from '../../hooks/useBehaviorTracking';

import { DataModelProvider } from '../itinerary/DataModelContext';
import MapPanel from '../itinerary/MapPanel';
import ActivityTimeline from '../itinerary/ActivityTimeline';
import MultiDayTabs, { getActivitiesForDay, getDayCount } from '../itinerary/MultiDayTabs';
import ActivityCard from '../itinerary/ActivityCard';
import ActivityCardSkeleton from '../itinerary/ActivityCardSkeleton';
import TravelSegmentCard from '../itinerary/TravelSegmentCard';
import { MultiRouteSelector } from '../itinerary/MultiRouteSelector';
import CopilotPanel from '../itinerary/CopilotPanel';
import ExecutionPanel from '../itinerary/ExecutionPanel';
import type { Alternative } from '../itinerary/ExecutionPanel';
import BottomActionBar from '../itinerary/BottomActionBar';
import type { ItineraryVariant, RouteMapData, RouteMapPoint, UIVariant } from '../itinerary/types';
import { inferSearchKeywords } from '../../services/ai/utils';
import { cachedSearchPOI } from '../../services/ai/cache';

import {
  CITY_CENTERS,
  formatMeters,
  formatMoney,
  coerceNumber,
  toFiniteCoordinate,
  formatStepCount,
  pathToPolyline,
  polylinePointCount,
  routeSegmentPolylineScore,
  routePolylineQualityScore,
  setsEqual,
  createEmptyModeMap,
  buildFallbackSegments,
  getModeRecommendationCopy,
  getModeToneLabel,
  getReadinessMeta,
  buildToolLabel,
  buildToolIconName,
  deriveFailedActivityIds,
  createExecutionRun,
  deriveFailedCallsFromResult,
  toExecutionRunRecord,
} from '../../utils/itineraryHelpers';
import type { ExecutionRunStatus, ExecutionRun } from '../../utils/itineraryHelpers';

interface ItineraryProps {
  plan: Plan | null;
  selectedIds: Set<string>;
  bookedIds: Set<string>;
  completedPlanIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onMarkBooked?: (ids: string[]) => void;
  onDeselectIds?: (ids: string[]) => void;
  onProceedPayment?: () => void;
  onActivityClick: (activity: Activity) => void;
  onBack: () => void;
  onShare?: () => void;
  onUpdatePlan?: (plan: Plan) => void;
  hideHeader?: boolean;
  profiles?: PersonProfile[];
  copilotMessages?: CopilotMessage[];
  onUpdateCopilotMessages?: (msgs: CopilotMessage[]) => void;
  onNavigate?: (screen: string) => void;
  onOpenTaxiFinder?: (data: import('../cards/TaxiCard').TaxiCardData) => void;
}

type VariantRouteMaps = Record<string, Partial<Record<TravelMode, RouteMapData>>>;
type VariantRouteResults = Record<
  string,
  Partial<Record<TravelMode, RoutePlanningResult | undefined>>
>;
type VariantRouteLoading = Record<string, Partial<Record<TravelMode, boolean>>>;
type VariantRouteErrors = Record<string, Partial<Record<TravelMode, string | null>>>;

interface PreparedVariantRouteContext {
  city: string;
  points: RouteMapPoint[];
  allLocations: Array<{ lng: number; lat: number }>;
  homeLocation?: { lat: number; lng: number; name: string };
}

interface TravelModeInsight {
  primary: string;
  secondary: string;
  badge?: string;
  score?: string;
}

function ItineraryInner({
  plan,
  selectedIds,
  bookedIds,
  completedPlanIds,
  onToggleSelect,
  onMarkBooked,
  onDeselectIds,
  onProceedPayment,
  onActivityClick,
  onBack,
  onShare,
  onUpdatePlan,
  hideHeader,
  profiles = [],
  onNavigate,
  onOpenTaxiFinder,
}: ItineraryProps) {
  const isPlanCompleted = completedPlanIds
    ? (plan?.id && completedPlanIds.has(plan.id)) || false
    : false;
  const upsertExecutionRun = useAppStore((state) => state.upsertExecutionRun);
  const upsertTaskState = useAppStore((state) => state.upsertTaskState);
  const setPendingPaymentIntent = useAppStore((state) => state.setPendingPaymentIntent);
  const behavior = useBehaviorTracking();

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [showConfirmExecute, setShowConfirmExecute] = useState(false);
  const [routeMap, setRouteMap] = useState<RouteMapData | null>(null);
  const [variantRouteMaps, setVariantRouteMaps] = useState<VariantRouteMaps>({});
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [copilotInitialMessage, setCopilotInitialMessage] = useState<string | undefined>(undefined);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [executionRun, setExecutionRun] = useState<ExecutionRun | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(1);
  const [selectedBudgetIdx, setSelectedBudgetIdx] = useState(1); // 默认标准版
  const [activeVariantId, setActiveVariantId] = useState('budget_1');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [executionAlternatives, setExecutionAlternatives] = useState<Record<string, Alternative[]>>(
    {}
  );

  const [executionPaused, setExecutionPaused] = useState(false);

  // 多路线规划状态
  const [variantRouteResults, setVariantRouteResults] = useState<VariantRouteResults>({});
  const [variantRouteLoading, setVariantRouteLoading] = useState<VariantRouteLoading>({});
  const [variantRouteErrors, setVariantRouteErrors] = useState<VariantRouteErrors>({});
  const variantRouteMapsRef = useRef<VariantRouteMaps>({});
  const variantRouteResultsRef = useRef<VariantRouteResults>({});

  const mountedRef = useRef(true);
  const lastStreamedPlanIdRef = useRef<string | undefined>(undefined);
  const homeLocationRef = useRef<{ lat: number; lng: number; name: string } | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryExecutionRef = useRef<(() => Promise<void>) | null>(null);
  const executionPlanRef = useRef<ExecutionPlan | null>(null);
  const executionRunStartedAtRef = useRef<number>(0);
  const selectionResetKeyRef = useRef<string | null>(null);

  const [streamingActivities, setStreamingActivities] = useState<Activity[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const commitExecutionRun = useCallback(
    (run: ExecutionRun) => {
      setExecutionRun(run);
      upsertExecutionRun(toExecutionRunRecord(run));
    },
    [upsertExecutionRun]
  );

  const readiness = plan?.executionReadiness;
  const readinessMeta = useMemo(() => getReadinessMeta(readiness), [readiness]);
  const hasBookedActivities = bookedIds.size > 0;
  const { travelMode, setTravelMode } = useTravelMode();
  // ── 路线规划偏好参数：优先用共创数据，降级用 profiles ──
  const collab = plan?.collaboration;
  const collabMembers = collab?.members || [];

  // 人数：计划中识别的人数 > 共创成员数 > profiles 数 > 1
  const peopleCount =
    plan?.memberCount || (collabMembers.length > 0 ? collabMembers.length : profiles.length || 1);

  // 预算版本切换
  const baseTotal = plan?.totalPrice || 0;
  const budgetOptions = useMemo(() => {
    const raw = plan?.budgetOptions?.length
      ? plan.budgetOptions
      : [
          {
            label: '经济版',
            perPerson: Math.round((baseTotal * 0.6) / peopleCount),
            total: Math.round(baseTotal * 0.6),
            strategy: '选择性价比最高的场所，节省 30-40%',
          },
          {
            label: '标准版',
            perPerson: Math.round(baseTotal / peopleCount),
            total: baseTotal,
            strategy: '平衡体验和价格，推荐方案',
          },
          {
            label: '品质版',
            perPerson: Math.round((baseTotal * 1.6) / peopleCount),
            total: Math.round(baseTotal * 1.6),
            strategy: '优先体验和品质，高端场所',
          },
        ];
    const prices = raw.map((o) => o.perPerson);
    if (prices.every((p) => p === prices[0]) && prices[0] > 0) {
      const sharedBase = prices[0];
      return raw.map((o, i) => ({
        ...o,
        perPerson:
          i === 0
            ? Math.round(sharedBase * 0.7)
            : i === 1
              ? sharedBase
              : Math.round(sharedBase * 1.5),
        total:
          i === 0
            ? Math.round(sharedBase * 0.7 * peopleCount)
            : i === 1
              ? sharedBase * peopleCount
              : Math.round(sharedBase * 1.5 * peopleCount),
      }));
    }
    return raw;
  }, [baseTotal, peopleCount, plan?.budgetOptions]);
  const variants = useMemo<ItineraryVariant[]>(
    () =>
      budgetOptions.map((option, index) => ({
        id: `budget_${index}`,
        label: option.label,
        source: 'budget' as const,
        activities: option.activities?.length ? option.activities : plan?.activities || [],
        total: option.total,
        perPerson: option.perPerson,
        strategy: option.strategy,
        recommended: index === 1,
      })),
    [budgetOptions, plan?.activities]
  );

  useEffect(() => {
    if (!variants.length) return;
    const safeIndex = Math.min(selectedBudgetIdx, variants.length - 1);
    const nextVariant = variants[safeIndex];
    if (nextVariant && nextVariant.id !== activeVariantId) {
      setActiveVariantId(nextVariant.id);
    }
  }, [activeVariantId, selectedBudgetIdx, variants]);

  const activeVariant =
    variants.find((variant) => variant.id === activeVariantId) ||
    variants[selectedBudgetIdx] ||
    variants[0];
  const currentBudget = activeVariant;
  const displayActivities = useMemo(() => {
    const raw = activeVariant?.activities || plan?.activities || [];
    let needsPatch = false;
    for (let i = 0; i < raw.length; i++) {
      if (!raw[i].id) {
        needsPatch = true;
        break;
      }
    }
    if (!needsPatch) return raw;
    return raw.map((a, i) => (a.id ? a : { ...a, id: `act_${plan?.id || 'p'}_${i}` }));
  }, [activeVariant?.activities, plan?.activities, plan?.id]);
  const displayPlan = useMemo<Plan | null>(() => {
    if (!plan) return null;
    const visibleIds = new Set(displayActivities.map((activity) => activity.id));
    const mappedDays = plan.days
      ?.map((day) => {
        const dayActivities = day.activities.filter((activity) => visibleIds.has(activity.id));
        return {
          ...day,
          activities: dayActivities,
          totalPrice: dayActivities.reduce((sum, activity) => sum + (activity.price || 0), 0),
        };
      })
      .filter((day) => day.activities.length > 0);

    return {
      ...plan,
      activities: displayActivities,
      totalPrice:
        currentBudget?.total ??
        displayActivities.reduce((sum, activity) => sum + (activity.price || 0), 0),
      days: mappedDays?.length ? mappedDays : undefined,
    };
  }, [currentBudget?.total, displayActivities, plan]);

  const selectedActivities = displayActivities.filter((activity) => selectedIds.has(activity.id));
  const timelineActivities = useMemo(
    () =>
      displayPlan
        ? getDayCount(displayPlan) > 1
          ? getActivitiesForDay(displayPlan, activeDayIndex)
          : displayActivities
        : [],
    [activeDayIndex, displayActivities, displayPlan]
  );

  const visibleIdSet = useMemo(
    () => new Set(displayActivities.map((a) => a.id)),
    [displayActivities]
  );

  useEffect(() => {
    if (!plan || !onDeselectIds || selectedIds.size === 0) return;

    const idsToRemove = Array.from(selectedIds).filter((id) => !visibleIdSet.has(id));
    if (idsToRemove.length === 0) return;

    onDeselectIds(idsToRemove);
  }, [visibleIdSet, onDeselectIds, plan, selectedIds]);

  useEffect(() => {
    if (!plan?.id || !onDeselectIds) return;

    const resetKey = `${plan.id}:${activeVariantId}`;
    if (selectionResetKeyRef.current === resetKey) return;

    selectionResetKeyRef.current = resetKey;
    if (selectedIds.size > 0) {
      onDeselectIds(Array.from(selectedIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariantId, onDeselectIds, plan?.id]);

  const handleMarkBooked = useCallback(
    (ids: string[]) => {
      onMarkBooked?.(ids);
      if (!plan) return;

      const budgetActivities =
        plan.budgetOptions?.flatMap((option) => option.activities || []) || [];
      for (const id of ids) {
        const activity =
          displayActivities.find((item) => item.id === id) ||
          plan.activities.find((item) => item.id === id) ||
          budgetActivities.find((item) => item.id === id);
        if (!activity) continue;

        learnFromActivity({
          title: activity.title,
          tags: activity.tags || [],
          price: activity.price || 0,
        }).catch(() => {
          /* silent */
        });

        behavior.trackComplete(plan.id || '', id, {
          activityTitle: activity.title,
          activityType: activity.type,
          tags: activity.tags,
          price: activity.price,
        });
      }
    },
    [behavior, displayActivities, onMarkBooked, plan]
  );

  const recordSuccessfulBookings = useCallback(
    (ids: string[]) => {
      if (!plan || ids.length === 0) return;
      const uniqueIds = Array.from(new Set(ids));
      handleMarkBooked(uniqueIds);
      onDeselectIds?.(uniqueIds);
      setPendingPaymentIntent((prev) => {
        const previousIds =
          prev?.planId === plan.id && prev.status === 'pending' ? prev.activityIds : [];
        const activityIds = Array.from(new Set([...previousIds, ...uniqueIds]));
        const activities = displayActivities.filter((activity) =>
          activityIds.includes(activity.id)
        );
        const amount = activities.reduce((sum, activity) => sum + (activity.price || 0), 0);
        return {
          id: `pay_${plan.id}_${activityIds.slice().sort().join('_')}`,
          planId: plan.id,
          activityIds,
          title: plan.title,
          merchantName:
            activities.find((activity) => activity.type === 'food')?.title || plan.title,
          amount,
          serviceCount: activities.length,
          peopleCount,
          status: 'pending',
          createdAt: prev?.planId === plan.id ? prev.createdAt : Date.now(),
        };
      });
    },
    [displayActivities, handleMarkBooked, onDeselectIds, peopleCount, plan, setPendingPaymentIntent]
  );

  const updateActiveVariantActivities = useCallback(
    (nextActivities: Activity[]) => {
      if (!plan || !onUpdatePlan) return;

      const nextTotal = nextActivities.reduce((sum, activity) => sum + (activity.price || 0), 0);
      const nextBudgetOptions = plan.budgetOptions?.map((option, index) => {
        const variant = variants[index];
        if (!variant || variant.id !== activeVariant?.id) return option;
        return {
          ...option,
          activities: nextActivities,
          total: nextTotal,
          perPerson: peopleCount > 0 ? Math.round(nextTotal / peopleCount) : option.perPerson,
        };
      });
      const shouldSyncPrimaryActivities =
        !plan.budgetOptions?.length || activeVariant?.id === 'budget_1';

      onUpdatePlan({
        ...plan,
        activities: shouldSyncPrimaryActivities ? nextActivities : plan.activities,
        totalPrice: shouldSyncPrimaryActivities ? nextTotal : plan.totalPrice,
        budgetOptions: nextBudgetOptions,
      });
    },
    [activeVariant?.id, onUpdatePlan, peopleCount, plan, variants]
  );

  useEffect(() => {
    variantRouteMapsRef.current = variantRouteMaps;
  }, [variantRouteMaps]);

  useEffect(() => {
    variantRouteResultsRef.current = variantRouteResults;
  }, [variantRouteResults]);

  // 从共创 votes/avoids 推断路线偏好
  const allVotes = collabMembers.flatMap((m) => m.votes || []);
  const allAvoids = collabMembers.flatMap((m) => m.avoids || []);

  // 是否有儿童/老人：先看 profiles，再从共创 votes 推断
  const hasChild =
    profiles.some((p) => p.ageGroup === '儿童') ||
    allVotes.some((v) => /儿童|小孩|亲子|baby|child/i.test(v));
  const hasElder =
    profiles.some((p) => p.ageGroup === '老年') ||
    allVotes.some((v) => /老人|长辈|老年|elder/i.test(v));

  // 是否偏好舒适：profiles + 共创 avoids（怕走/怕排队）
  const comfortPreferred =
    profiles.some(
      (p) =>
        p.mobility === '较弱' ||
        p.travelPreferences.some((pref) => /轻松|舒适|不爱走|少走/.test(pref)) ||
        p.specialNeeds?.some((need) => /婴儿车|轮椅|行动/.test(need))
    ) ||
    allAvoids.some((a) => /走路|步行|暴走|累|排队/.test(a)) ||
    allVotes.some((v) => /轻松|舒适|休闲|不累/.test(v));

  // 是否预算敏感：profiles + 共创 votes/avoids
  const budgetSensitive =
    profiles.some(
      (p) => p.budget?.includes('低') || p.travelPreferences.some((pref) => /省钱|预算/.test(pref))
    ) ||
    allVotes.some((v) => /省钱|经济|便宜|预算/.test(v)) ||
    allAvoids.some((a) => /贵|花费|消费/.test(a));

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    function isValidCoordinate(lat: unknown, lng: unknown): boolean {
      return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    }

    function generateEstimatedLocation(city: string, seed: string): { lng: number; lat: number } {
      const cityCenters = CITY_CENTERS;

      const center = cityCenters[city] || { lng: 116.404, lat: 39.915 };
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      const lngSeed = Math.abs(hash % 1000) / 1000;
      const latSeed = Math.abs(((hash >> 3) ^ (hash << 7)) % 1000) / 1000;
      const offset = 0.018;
      return {
        lng: center.lng + (lngSeed - 0.5) * offset,
        lat: center.lat + (latSeed - 0.5) * offset,
      };
    }

    async function loadRoute() {
      if (!plan || plan.activities.length === 0) {
        setRouteMap(null);
        return;
      }

      setIsRouteLoading(true);
      setRouteError(null);

      try {
        if (!activeVariant) {
          setRouteMap(null);
          setRouteSegments([]);
          return;
        }

        const variantId = activeVariant.id;
        const city = plan.city || '北京';
        const activities = activeVariant.activities.filter(
          (activity) => activity.type !== 'travel'
        );

        const userLoc = await getUserLocation();
        let homeLocation: { lat: number; lng: number; name: string } | undefined;
        const homeLat = toFiniteCoordinate(userLoc?.lat);
        const homeLng = toFiniteCoordinate(userLoc?.lng);
        if (homeLat !== null && homeLng !== null && isValidCoordinate(homeLat, homeLng)) {
          homeLocation = { lat: homeLat, lng: homeLng, name: '当前位置' };
        }
        homeLocationRef.current = homeLocation;

        const located = await Promise.all(
          activities.map(async (activity, index) => {
            if (isValidCoordinate(activity.lat, activity.lng)) {
              const lat = toFiniteCoordinate(activity.lat);
              const lng = toFiniteCoordinate(activity.lng);
              if (lat === null || lng === null) return null;
              return {
                activityId: activity.id,
                title: activity.title,
                location: { lat, lng },
              };
            }

            const pois = await searchSmartNearby(activity.title, city, 5000);
            const best = pois[0];
            const poiLat = toFiniteCoordinate(best?.location?.lat);
            const poiLng = toFiniteCoordinate(best?.location?.lng);
            if (poiLat !== null && poiLng !== null && isValidCoordinate(poiLat, poiLng)) {
              return {
                activityId: activity.id,
                title: activity.title,
                location: { lat: poiLat, lng: poiLng },
              };
            }

            const estimated = generateEstimatedLocation(
              city,
              `${activity.id}_${activity.title}_${index}`
            );
            return { activityId: activity.id, title: activity.title, location: estimated };
          })
        );

        const points = located.filter(Boolean) as RouteMapData['points'];
        if (points.length === 0) {
          if (!signal.aborted) setRouteMap(null);
          return;
        }

        const preparedContext: PreparedVariantRouteContext = {
          city,
          points,
          homeLocation,
          allLocations: homeLocation
            ? [homeLocation, ...points.map((p) => p.location), homeLocation]
            : points.map((p) => p.location),
        };

        const buildMapForVariantMode = async (
          mode: TravelMode
        ): Promise<{ map: RouteMapData; result: RoutePlanningResult }> => {
          const {
            allLocations,
            city: routeCity,
            points: routePoints,
            homeLocation: routeHomeLocation,
          } = preparedContext;
          const isLoopRoute = true;
          let route = null as Awaited<ReturnType<typeof planMultiPointRoute>> | null;
          let guidedRoute = null as RoutePlanningResult | null;
          let restRoute = null as Awaited<ReturnType<typeof planMultiPointRoute>> | null;
          let resolvedRouteSource: RouteMapData['routeSource'] = 'draft';
          let useGuidedResultData = false;

          try {
            guidedRoute = await routePlanningService.planRoute(allLocations, mode, routeCity);
          } catch (routeErr) {
            console.warn(`[Itinerary] AMap JS 路线规划失败 (${mode}):`, routeErr);
          }

          try {
            restRoute = await planMultiPointRoute(allLocations, mode, routeCity);
          } catch (restErr) {
            console.warn(`[Itinerary] REST API 路线规划失败 (${mode}):`, restErr);
          }

          const guidedCandidate = guidedRoute?.segments.length
            ? {
                totalDistance: guidedRoute.totalDistance,
                totalDuration: guidedRoute.totalTime,
                segments: guidedRoute.segments.map((segment) => ({
                  distance: segment.distance,
                  duration: segment.time,
                  mode,
                  steps: segment.steps || [],
                  polyline: pathToPolyline(segment.path),
                  transfers: segment.transfers,
                  walkingDistance: segment.walkingDistance,
                  instruction: segment.instruction,
                  transitDetails: segment.transitDetails,
                })),
              }
            : null;
          const guidedQuality = routePolylineQualityScore(guidedCandidate?.segments);
          const restQuality = routePolylineQualityScore(restRoute?.segments);

          if (mode === 'transit') {
            if (restQuality >= guidedQuality && restRoute) {
              route = restRoute;
            } else {
              route = guidedCandidate;
              useGuidedResultData = !!guidedCandidate;
            }
          } else if (mode === 'cycling') {
            if (restQuality > 0 && restRoute) {
              route = restRoute;
            } else if (guidedQuality > 0 && guidedCandidate) {
              route = guidedCandidate;
              useGuidedResultData = true;
            } else {
              try {
                const walkRest = await planMultiPointRoute(allLocations, 'walking', routeCity);
                const walkRestQ = routePolylineQualityScore(walkRest?.segments);
                if (walkRestQ > 0 && walkRest) {
                  route = walkRest;
                  restRoute = walkRest;
                } else {
                  const walkGuided = await routePlanningService.planRoute(
                    allLocations,
                    'walking',
                    routeCity
                  );
                  if (walkGuided?.segments.length) {
                    const walkCandidate = {
                      totalDistance: walkGuided.totalDistance,
                      totalDuration: walkGuided.totalTime,
                      segments: walkGuided.segments.map((segment) => ({
                        distance: segment.distance,
                        duration: segment.time,
                        mode: 'walking' as TravelMode,
                        steps: segment.steps || [],
                        polyline: pathToPolyline(segment.path),
                        instruction: segment.instruction,
                      })),
                    };
                    if (routePolylineQualityScore(walkCandidate.segments) > 0) {
                      route = walkCandidate;
                      guidedRoute = walkGuided;
                      useGuidedResultData = true;
                    }
                  }
                }
              } catch (walkErr) {
                console.warn('[Itinerary] walking fallback for cycling failed:', walkErr);
              }
              if (!route) route = null;
            }
          } else if (guidedCandidate || restRoute) {
            if (guidedQuality >= restQuality && guidedCandidate) {
              route = guidedCandidate;
              useGuidedResultData = true;
            } else {
              route = restRoute || guidedCandidate;
            }
          } else {
            route = null;
          }

          const chosenQuality = routePolylineQualityScore(route?.segments);

          if (route && chosenQuality > 0) {
            resolvedRouteSource = 'planned';
          } else {
            const allPoints: RouteMapData['points'] = routeHomeLocation
              ? [
                  {
                    activityId: 'home-start',
                    title: '起点',
                    location: routeHomeLocation,
                    isHome: true,
                  },
                  ...routePoints,
                  {
                    activityId: 'home-end',
                    title: '终点',
                    location: routeHomeLocation,
                    isHome: true,
                  },
                ]
              : routePoints;
            const fallbackSegments = buildFallbackSegments(allPoints, mode);
            route = {
              totalDistance: fallbackSegments.reduce((sum, segment) => sum + segment.distance, 0),
              totalDuration: fallbackSegments.reduce((sum, segment) => sum + segment.duration, 0),
              segments: fallbackSegments.map((segment) => ({
                distance: segment.distance,
                duration: segment.duration,
                mode: segment.mode,
                steps: segment.steps || [],
                polyline: segment.polyline,
                cost: segment.cost,
                transfers: segment.transfers,
                walkingDistance: segment.walkingDistance,
                taxi: segment.taxi,
              })),
            };
            resolvedRouteSource = 'fallback';
          }

          const enhancedSegments: RouteSegment[] = route.segments.map((segment, index) => {
            const fromLoc = allLocations[index];
            const toLoc = allLocations[index + 1];
            const isStartSegment = !!(index === 0 && routeHomeLocation);
            const isEndSegment = !!(index === route.segments.length - 1 && routeHomeLocation);

            let fromName = '';
            let toName = '';

            if (routeHomeLocation) {
              if (index === 0) {
                fromName = '起点';
                toName = routePoints[0]?.title || '第1站';
              } else if (index === route.segments.length - 1) {
                fromName = routePoints[routePoints.length - 1]?.title || '最后一站';
                toName = '终点';
              } else {
                fromName = routePoints[index - 1]?.title || `第${index}站`;
                toName = routePoints[index]?.title || `第${index + 1}站`;
              }
            } else {
              fromName = routePoints[index]?.title || `第 ${index + 1} 站`;
              toName = routePoints[index + 1]?.title || `第 ${index + 2} 站`;
            }

            const baseSegment: RouteSegment = {
              ...segment,
              from: {
                name: fromName,
                lat: fromLoc?.lat || 0,
                lng: fromLoc?.lng || 0,
              },
              to: {
                name: toName,
                lat: toLoc?.lat || 0,
                lng: toLoc?.lng || 0,
              },
              mode,
              isLoopSegment: isStartSegment || isEndSegment,
            };

            const guidedPolyline = guidedRoute?.segments[index]?.path?.length
              ? pathToPolyline(guidedRoute.segments[index].path)
              : undefined;
            const restPolyline = restRoute?.segments[index]?.polyline;
            const segmentPolyline =
              mode === 'transit'
                ? polylinePointCount(restPolyline) >= polylinePointCount(guidedPolyline)
                  ? restPolyline || guidedPolyline || segment.polyline
                  : guidedPolyline || restPolyline || segment.polyline
                : routeSegmentPolylineScore(restRoute?.segments[index]) >
                    routeSegmentPolylineScore({ polyline: guidedPolyline })
                  ? restPolyline || guidedPolyline || segment.polyline
                  : guidedPolyline || restPolyline || segment.polyline;

            if (mode === 'taxi') {
              const taxi = estimateTaxiDispatch({
                peopleCount,
                hasChild,
                hasElder,
                comfortPreferred,
                budgetSensitive,
                distanceMeters: segment.distance,
                durationMinutes: segment.duration,
              });
              return {
                ...baseSegment,
                duration: Math.max(4, segment.duration + taxi.estimatedWaitMinutes),
                cost: taxi.estimatedFare,
                taxi,
                polyline: segmentPolyline,
                steps: [
                  `预计 ${taxi.estimatedWaitMinutes} 分钟上车`,
                  `${taxi.tierLabel} · ${taxi.passengerSummary}`,
                  taxi.reason,
                ],
              };
            }
            if (mode === 'transit') {
              return {
                ...baseSegment,
                polyline: segmentPolyline,
                cost: Math.max(2, Math.round(segment.distance / 5000) * 2),
                transfers:
                  segment.transfers ??
                  restRoute?.segments[index]?.transfers ??
                  guidedRoute?.segments[index]?.transfers,
                walkingDistance:
                  segment.walkingDistance ??
                  restRoute?.segments[index]?.walkingDistance ??
                  guidedRoute?.segments[index]?.walkingDistance,
                instruction:
                  segment.instruction ||
                  restRoute?.segments[index]?.steps?.[0] ||
                  guidedRoute?.segments[index]?.instruction,
                transitDetails:
                  segment.transitDetails ||
                  restRoute?.segments[index]?.transitDetails ||
                  guidedRoute?.segments[index]?.transitDetails,
              };
            }
            if (mode === 'walking') {
              return {
                ...baseSegment,
                polyline: segmentPolyline,
                duration: Math.max(segment.duration, Math.round(segment.distance / 70)),
                steps: segment.steps?.length
                  ? segment.steps
                  : ['适合慢逛', formatStepCount(segment.distance)],
                cost: 0,
                instruction: segment.instruction,
              };
            }
            if (mode === 'cycling') {
              return {
                ...baseSegment,
                polyline: segmentPolyline,
                duration: Math.max(3, segment.duration),
                steps: segment.steps?.length ? segment.steps : ['更适合近距离串点', '骑行节奏自由'],
                cost: 0,
                instruction: segment.instruction,
              };
            }
            return {
              ...baseSegment,
              polyline: segmentPolyline,
              steps: segment.steps?.length ? segment.steps : ['连续跑点更顺', '适合高效切换'],
              cost: 0,
              instruction: segment.instruction,
            };
          });

          const totalDurationMin = enhancedSegments.reduce(
            (sum, segment) => sum + segment.duration,
            0
          );
          const totalCost = enhancedSegments.reduce((sum, segment) => sum + (segment.cost || 0), 0);

          const mapData: RouteMapData = {
            totalDistanceKm: (route.totalDistance / 1000).toFixed(1),
            totalDurationMin,
            totalCost,
            city: routeCity,
            points: routePoints,
            segments: enhancedSegments,
            isLoopRoute,
            homeLocation: routeHomeLocation,
            routeSource: resolvedRouteSource,
          };

          const resultData: RoutePlanningResult = {
            totalTime: totalDurationMin,
            totalDistance: route.totalDistance,
            segments: useGuidedResultData
              ? (guidedRoute?.segments as RouteSegmentResult[]) ||
                route.segments.map((s) => ({ ...s, time: s.duration }) as RouteSegmentResult)
              : route.segments.map((s) => ({ ...s, time: s.duration }) as RouteSegmentResult),
            path: guidedRoute?.path || [],
          };

          if (import.meta.env.DEV) {
            const polylineSegmentCount = enhancedSegments.filter(
              (segment) =>
                typeof segment.polyline === 'string' && segment.polyline.split(';').length > 1
            ).length;
            console.info('[Itinerary][RouteDebug]', {
              variantId,
              mode,
              routeSource: resolvedRouteSource,
              segmentCount: enhancedSegments.length,
              polylineSegmentCount,
              guidedQuality,
              restQuality,
              chosenQuality,
              guidedSegmentCount: guidedRoute?.segments.length || 0,
            });
          }

          return { map: mapData, result: resultData };
        };

        // 只先加载当前选中的模式，其他模式懒加载
        // 使用函数式更新避免 stale closure
        try {
          // 先只加载当前选中的模式
          if (!signal.aborted) {
            setVariantRouteLoading((prev) => ({
              ...prev,
              [variantId]: {
                ...createEmptyModeMap(() => false),
                ...(prev[variantId] || {}),
                [travelMode]: true,
              },
            }));
          }

          const cachedMap = variantRouteMapsRef.current[variantId]?.[travelMode];
          const cachedResult = variantRouteResultsRef.current[variantId]?.[travelMode];
          const { map, result } =
            cachedMap && cachedResult
              ? { map: cachedMap, result: cachedResult }
              : await buildMapForVariantMode(travelMode);

          if (!signal.aborted) {
            if (map) {
              setVariantRouteMaps((prev) => ({
                ...prev,
                [variantId]: {
                  ...(prev[variantId] || {}),
                  [travelMode]: map,
                },
              }));
              setRouteMap(map);
              setRouteSegments(map.segments || []);
            }
            if (result) {
              setVariantRouteResults((prev) => ({
                ...prev,
                [variantId]: {
                  ...(prev[variantId] || {}),
                  [travelMode]: result,
                },
              }));
            }
            setVariantRouteErrors((prev) => ({
              ...prev,
              [variantId]: {
                ...createEmptyModeMap(() => null),
                ...(prev[variantId] || {}),
                [travelMode]: null,
              },
            }));
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '路线规划失败';
          if (!signal.aborted) {
            setVariantRouteErrors((prev) => ({
              ...prev,
              [variantId]: {
                ...createEmptyModeMap(() => null),
                ...(prev[variantId] || {}),
                [travelMode]: errorMsg,
              },
            }));
          }
        }

        // 更新 loading 状态
        if (!signal.aborted) {
          setVariantRouteLoading((prev) => ({
            ...prev,
            [variantId]: {
              ...createEmptyModeMap(() => false),
              ...(prev[variantId] || {}),
              [travelMode]: false,
            },
          }));
        }
      } catch (err) {
        if (!signal.aborted) {
          setRouteMap(null);
          setRouteSegments([]);
          setRouteError('路线加载失败，请稍后重试');
          if (activeVariant?.id) {
            setVariantRouteLoading((prev) => ({
              ...prev,
              [activeVariant.id]: createEmptyModeMap(() => false),
            }));
          }
        }
      } finally {
        if (!signal.aborted) setIsRouteLoading(false);
      }
    }

    void loadRoute();
    return () => {
      ac.abort();
    };
  }, [
    activeVariant,
    plan,
    travelMode,
    peopleCount,
    hasChild,
    hasElder,
    comfortPreferred,
    budgetSensitive,
  ]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    executionPlanRef.current = executionPlan;
  }, [executionPlan]);

  useEffect(() => {
    if (!displayActivities.length) {
      setStreamingActivities([]);
      setIsStreaming(false);
      return;
    }

    const streamKey = `${plan?.id || 'plan'}_${activeVariantId}_${displayActivities.map((a) => a.id).join(',')}`;
    if (streamKey === lastStreamedPlanIdRef.current) return;
    lastStreamedPlanIdRef.current = streamKey;

    setStreamingActivities([]);
    setIsStreaming(true);

    let index = 0;
    const total = displayActivities.length;
    const interval = setInterval(
      () => {
        if (index < total) {
          const activity = displayActivities[index];
          if (activity && activity.id) {
            setStreamingActivities((prev) => [...prev, activity]);
          }
          index++;
        } else {
          clearInterval(interval);
          setIsStreaming(false);
        }
      },
      300 + Math.random() * 200
    );

    return () => clearInterval(interval);
  }, [activeVariantId, displayActivities, plan?.id]);

  const routePointCards = useMemo(
    () =>
      routeMap?.points.map((point, index) => ({
        ...point,
        segmentToNext: routeMap?.segments?.[index],
      })) || [],
    [routeMap]
  );

  const activeVariantRouteMaps = useMemo(
    () => (activeVariant?.id ? variantRouteMaps[activeVariant.id] || {} : {}),
    [activeVariant?.id, variantRouteMaps]
  );

  const activeVariantRouteResults = useMemo(
    () => (activeVariant?.id ? variantRouteResults[activeVariant.id] || {} : {}),
    [activeVariant?.id, variantRouteResults]
  );

  const activeVariantRouteLoading = useMemo(
    () =>
      activeVariant?.id
        ? {
            ...createEmptyModeMap(() => false),
            ...(variantRouteLoading[activeVariant.id] || {}),
          }
        : createEmptyModeMap(() => false),
    [activeVariant?.id, variantRouteLoading]
  );

  const activeVariantRouteErrors = useMemo(
    () =>
      activeVariant?.id
        ? {
            ...createEmptyModeMap(() => null),
            ...(variantRouteErrors[activeVariant.id] || {}),
          }
        : createEmptyModeMap(() => null),
    [activeVariant?.id, variantRouteErrors]
  );

  const travelModeInsights = useMemo(() => {
    const actualDuration = routeMap?.totalDurationMin || 0;
    const actualDistance = routeMap ? Number(routeMap.totalDistanceKm) * 1000 : 0;
    const modeMap: Partial<Record<TravelMode, TravelModeInsight>> = {};

    TRAVEL_MODE_ORDER.forEach((mode) => {
      const modeRoute = mode === travelMode ? routeMap : activeVariantRouteMaps[mode];
      const duration = modeRoute?.totalDurationMin || (mode === travelMode ? actualDuration : 0);
      const distance = modeRoute ? Number(modeRoute.totalDistanceKm) * 1000 : actualDistance;
      const totalTransfers =
        modeRoute?.segments?.reduce((sum, segment) => sum + (segment.transfers || 0), 0) || 0;
      const taxiSample = modeRoute?.segments?.find((segment) => segment.taxi)?.taxi || null;
      const cost = modeRoute?.totalCost;
      const copy = getModeRecommendationCopy(mode, {
        duration,
        distance,
        cost,
        taxi: mode === 'taxi' ? taxiSample : null,
        transfers: totalTransfers,
      });

      let badge: string | undefined;
      if (mode === travelMode) badge = '当前';
      else if (mode === 'driving' && mode !== travelMode) badge = '顺路';
      else if (mode === 'taxi')
        badge = peopleCount > 2 || hasChild || hasElder ? '推荐' : undefined;
      else if (mode === 'walking' && distance <= 2500) badge = '轻松';
      else if (mode === 'transit') badge = '省钱';

      modeMap[mode] = {
        primary: duration ? `${duration} 分钟` : '--',
        secondary: copy.detail,
        badge,
        score: getModeToneLabel(mode, {
          peopleCount,
          hasChild,
          hasElder,
          distance,
          duration,
          transfers: totalTransfers,
        }),
      };
    });

    return modeMap;
  }, [activeVariantRouteMaps, routeMap, travelMode, peopleCount, hasChild, hasElder]);

  const activeTaxiRecommendation =
    routeMap?.segments?.find((segment) => segment.taxi)?.taxi || null;

  const routeHeadline = useMemo(() => {
    if (!routeMap) {
      return { title: '路线正在整理中', detail: '先看点位，稍后会补足每段出行反馈' };
    }
    return getModeRecommendationCopy(travelMode, {
      duration: routeMap.totalDurationMin,
      distance: Number(routeMap.totalDistanceKm) * 1000,
      cost: routeMap.totalCost,
      taxi: activeTaxiRecommendation,
      transfers: routeMap.segments?.reduce((sum, segment) => sum + (segment.transfers || 0), 0),
    });
  }, [routeMap, travelMode, activeTaxiRecommendation]);

  const executeButtonLabel = useMemo(() => {
    return selectedIds.size > 0 ? '一键执行预订' : '先勾选要执行的项目';
  }, [selectedIds.size]);

  const readinessBadgeText =
    readiness?.status === 'ready'
      ? '路线可用'
      : readiness?.status === 'adjust'
        ? '建议微调'
        : '需先调整';

  const actualDurations = useMemo(() => {
    const map = new Map<number, number>();
    // 如果有 homeLocation，我们需要包含起点和终点的时间
    if (routeMap?.homeLocation) {
      // 第一个活动的时间是从家出发到第一个地点
      const firstDuration = routeMap?.segments?.[0]?.duration;
      if (firstDuration != null) map.set(1, firstDuration);

      // 中间活动的时间
      displayActivities.forEach((_, index) => {
        if (index > 0) {
          const duration = routeMap?.segments?.[index]?.duration;
          if (duration != null) map.set(index + 1, duration);
        }
      });

      // 最后一个活动到家的时间
      const lastDuration = routeMap?.segments?.[routeMap.segments.length - 1]?.duration;
      if (lastDuration != null) map.set(displayActivities.length + 1, lastDuration);
    } else {
      // 没有 homeLocation 的情况，保持原有逻辑
      displayActivities.forEach((_, index) => {
        if (index > 0) {
          const duration = routeMap?.segments?.[index - 1]?.duration;
          if (duration != null) map.set(index, duration);
        }
      });
    }
    return map;
  }, [displayActivities, routeMap]);

  const handleUpdateActivities = useCallback(
    (activities: Activity[]) => {
      if (!plan || !onUpdatePlan) return;

      if (timelineActivities.length === displayActivities.length) {
        updateActiveVariantActivities(activities);
        return;
      }

      const visibleIds = new Set(timelineActivities.map((activity) => activity.id));
      let reorderedIndex = 0;
      const mergedActivities = displayActivities.map((activity) =>
        visibleIds.has(activity.id) ? activities[reorderedIndex++] || activity : activity
      );
      updateActiveVariantActivities(mergedActivities);
    },
    [displayActivities, onUpdatePlan, plan, timelineActivities, updateActiveVariantActivities]
  );

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const currentPlan = executionPlanRef.current;
    if (currentPlan) {
      commitExecutionRun(
        createExecutionRun(currentPlan, {
          planId: plan?.id,
          status: 'cancelled',
          answer: '已取消执行',
          startedAt: executionRunStartedAtRef.current || Date.now(),
          completedAt: Date.now(),
        })
      );
    }
    setIsExecuting(false);
    setExecutionPaused(false);
  }, [plan?.id]);

  const handleBookTaxi = useCallback(
    (
      from: { name: string; lat: number; lng: number },
      to: { name: string; lat: number; lng: number }
    ) => {
      const activity = displayActivities.find((a) => a.title === to.name);
      if (onOpenTaxiFinder) {
        const dist = Math.round(
          Math.sqrt(
            Math.pow((to.lat - from.lat) * 111000, 2) +
              Math.pow((to.lng - from.lng) * 111000 * Math.cos((to.lat * Math.PI) / 180), 2)
          )
        );
        onOpenTaxiFinder({
          destinationName: to.name,
          lat: to.lat,
          lng: to.lng,
          distanceMeters: dist || 3600,
          durationMinutes: Math.max(5, Math.round((dist || 3600) / 500)),
          activityTimeLine: activity?.timeLine,
        });
      }
    },
    [displayActivities, onOpenTaxiFinder]
  );

  // 继续执行函数（用于从失败恢复）
  const handleContinueFromFailure = useCallback(async () => {
    if (executionPaused) {
      setExecutionPaused(false);
      await retryExecutionRef.current?.();
    }
  }, [executionPaused]);

  const handleExecute = useCallback(async () => {
    if (!plan || isExecuting) return;
    if (selectedActivities.length === 0) return;
    setShowConfirmExecute(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const basePlan = buildExecutionPlan(selectedActivities, plan.title, peopleCount, {
      city: plan.city,
      travelMode,
    });
    executionRunStartedAtRef.current = Date.now();
    const runningPlan = { ...basePlan, status: 'running' as const };
    executionPlanRef.current = runningPlan;
    setExecutionPlan(runningPlan);
    commitExecutionRun(
      createExecutionRun(runningPlan, {
        planId: plan.id,
        status: 'running',
        answer: `正在执行 ${selectedActivities.length} 个项目`,
        startedAt: executionRunStartedAtRef.current,
      })
    );
    setIsExecuting(true);
    setAgentSteps([]);
    setAgentResult(null);

    const fallbackToLocalExecution = async () => {
      if (abortController.signal.aborted) {
        setIsExecuting(false);
        setAgentResult({
          answer: '已取消执行',
          steps: [],
          totalToolCalls: 0,
          successCount: 0,
          failCount: 0,
          isCancelled: true,
        });
        commitExecutionRun(
          createExecutionRun(
            { ...basePlan, status: 'partial_failed' },
            {
              planId: plan.id,
              status: 'cancelled',
              answer: '已取消执行',
              startedAt: executionRunStartedAtRef.current,
              completedAt: Date.now(),
            }
          )
        );
        return;
      }

      const localResult = await executePlan(
        { ...basePlan, status: 'running' },
        (nextPlan) => {
          executionPlanRef.current = { ...nextPlan };
          setExecutionPlan({ ...nextPlan });
        },
        1,
        { signal: abortController.signal }
      );

      if (!mountedRef.current) return;

      const successActivityIds = selectedActivities
        .filter((activity) =>
          localResult.calls.some(
            (call) =>
              call.status === 'success' &&
              (call.tool === 'make_reservation' || call.tool === 'book_activity') &&
              call.input?.name === activity.title
          )
        )
        .map((activity) => activity.id);

      recordSuccessfulBookings(successActivityIds);

      setAgentResult({
        answer:
          localResult.status === 'partial_failed'
            ? '已完成大部分预订，可重试失败项。'
            : '已处理完成，可直接去付款。',
        steps: [],
        totalToolCalls: localResult.calls.length,
        successCount: localResult.calls.filter((call) => call.status === 'success').length,
        failCount: localResult.calls.filter((call) => call.status === 'failed').length,
      });
      executionPlanRef.current = localResult;
      setExecutionPlan(localResult);
      commitExecutionRun(
        createExecutionRun(localResult, {
          planId: plan.id,
          status: localResult.status === 'partial_failed' ? 'partial_failed' : 'completed',
          answer:
            localResult.status === 'partial_failed'
              ? '已完成大部分预订，可重试失败项。'
              : '已处理完成，可直接去付款。',
          startedAt: executionRunStartedAtRef.current,
          completedAt: localResult.completedAt || Date.now(),
        })
      );
      setIsExecuting(false);
    };

    const result = await agentExecute(
      {
        planId: plan.id,
        activities: selectedActivities,
        planTitle: plan.title,
        city: plan.city || '北京',
        peopleCount,
        onStep: (step) => {
          setAgentSteps((prev) => {
            const idx = prev.findIndex((item) => item.id === step.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = step;
              return next;
            }
            return [...prev, step];
          });

          if (step.type !== 'tool_result') return;

          setExecutionPlan((prev) => {
            if (!prev) return prev;
            const nextCalls = [...prev.calls];
            const targetIndex = findCallIndex(nextCalls, step);

            if (targetIndex >= 0) {
              nextCalls[targetIndex] = {
                ...nextCalls[targetIndex],
                tool: (step.toolName || nextCalls[targetIndex].tool) as ToolName,
                label: buildToolLabel(step.toolName, step.toolArgs),
                icon: buildToolIconName(step.toolName),
                input: step.toolArgs || nextCalls[targetIndex].input,
                status: step.status,
                result: step.toolResult,
                error: step.status === 'failed' ? step.toolResult?.message : undefined,
                finishedAt: step.finishedAt,
              };
            }

            const upcomingIndex = nextCalls.findIndex((call) => call.status === 'pending');
            if (upcomingIndex >= 0) {
              nextCalls[upcomingIndex] = { ...nextCalls[upcomingIndex], status: 'running' };
            }

            const nextPlan = { ...prev, calls: nextCalls };
            executionPlanRef.current = nextPlan;
            return nextPlan;
          });

          if (step.status === 'failed' && step.toolArgs) {
            const failedActivityName =
              typeof step.toolArgs.name === 'string'
                ? step.toolArgs.name
                : typeof step.toolArgs.to === 'string'
                  ? step.toolArgs.to
                  : '';

            if (failedActivityName) {
              const failedAct = selectedActivities.find((act) => act.title === failedActivityName);
              if (failedAct) {
                abortController.abort();
                setExecutionPaused(true);
              }
            }
          }
        },
      },
      { signal: abortController.signal }
    );

    if (!mountedRef.current) return;

    if (result.isCancelled) {
      setAgentResult(result);
      const successfulBeforeCancel = selectedActivities
        .filter((activity) =>
          result.steps.some(
            (step) =>
              step.type === 'tool_result' &&
              step.status === 'success' &&
              (step.toolName === 'make_reservation' || step.toolName === 'book_activity') &&
              step.toolArgs?.name === activity.title
          )
        )
        .map((activity) => activity.id);
      recordSuccessfulBookings(successfulBeforeCancel);
      const latestPlan = executionPlanRef.current || {
        ...basePlan,
        status: 'partial_failed' as const,
      };
      commitExecutionRun(
        createExecutionRun(latestPlan, {
          planId: plan.id,
          status: 'cancelled',
          answer: result.answer,
          startedAt: executionRunStartedAtRef.current,
          completedAt: Date.now(),
        })
      );
      setIsExecuting(false);
      return;
    }

    if (
      result.totalToolCalls === 0 &&
      result.successCount === 0 &&
      result.failCount === 0 &&
      result.answer.startsWith('Agent 执行出错')
    ) {
      await fallbackToLocalExecution();
      return;
    }

    setAgentResult(result);
    setIsExecuting(false);
    const successActivityIds = selectedActivities
      .filter((activity) =>
        result.steps.some(
          (step) =>
            step.type === 'tool_result' &&
            step.status === 'success' &&
            (step.toolName === 'make_reservation' || step.toolName === 'book_activity') &&
            step.toolArgs?.name &&
            (String(step.toolArgs.name) === activity.title ||
              String(step.toolArgs.name).includes(activity.title) ||
              activity.title.includes(String(step.toolArgs.name)))
        )
      )
      .map((activity) => activity.id);

    recordSuccessfulBookings(successActivityIds);

    const completedAt = Date.now();
    const latestPlan = executionPlanRef.current;
    const finalExecutionPlan = latestPlan
      ? ({
          ...latestPlan,
          status: result.failCount > 0 ? 'partial_failed' : 'completed',
          completedAt,
          calls: latestPlan.calls.map((call) =>
            call.status === 'running'
              ? call.tool === 'calculate_route'
                ? {
                    ...call,
                    status: 'success',
                    result: { success: true, message: '已沿用行程页实时路线' },
                    finishedAt: completedAt,
                  }
                : { ...call, status: 'failed', error: '执行超时，未收到结果' }
              : call
          ),
        } as ExecutionPlan)
      : null;

    if (finalExecutionPlan) {
      executionPlanRef.current = finalExecutionPlan;
      setExecutionPlan(finalExecutionPlan);
      commitExecutionRun(
        createExecutionRun(finalExecutionPlan, {
          planId: plan.id,
          status: result.failCount > 0 ? 'partial_failed' : 'completed',
          answer: result.answer,
          startedAt: executionRunStartedAtRef.current,
          completedAt,
        })
      );
    }

    // 搜索替代方案（当有失败项时）
    if (result.failCount > 0 && plan?.city) {
      const failedCalls = deriveFailedCallsFromResult(
        finalExecutionPlan || executionPlanRef.current,
        result
      );
      const newAlternatives: Record<string, Alternative[]> = {};

      for (const call of failedCalls) {
        const failedName =
          typeof call.input?.name === 'string'
            ? call.input.name
            : call.label.replace(/^(查询|预订|预约)\s*/, '').trim();
        try {
          const keywords = inferSearchKeywords(failedName);
          const pois = await cachedSearchPOI(keywords.food, plan.city, 1000);
          const filtered = pois.filter((p) => p.name !== failedName);
          newAlternatives[call.id] = filtered
            .sort((a, b) => coerceNumber(b.rating) - coerceNumber(a.rating))
            .slice(0, 3)
            .map((p, index) => ({
              id: `${call.id}_alt_${index}_${p.name}`,
              name: p.name,
              distance: coerceNumber(p.distance),
              rating: coerceNumber(p.rating, 4.5),
              price: coerceNumber(p.cost),
              address: p.address || '',
            }));
        } catch (e) {
          console.warn('[Itinerary] Failed to search alternatives for', failedName, e);
        }
      }

      if (Object.keys(newAlternatives).length > 0) {
        setExecutionAlternatives((prev) => ({ ...prev, ...newAlternatives }));
      }
    }
  }, [
    plan,
    selectedActivities,
    peopleCount,
    isExecuting,
    recordSuccessfulBookings,
    travelMode,
    handleCancel,
    executionPlan,
  ]);

  const handleRetryFailedExecution = useCallback(async () => {
    if (!plan || isExecuting) return;
    const failedIds = deriveFailedActivityIds(selectedActivities, executionPlan, agentResult);
    if (failedIds.length === 0) return;

    const retryActivities = selectedActivities.filter((activity) =>
      failedIds.includes(activity.id)
    );
    if (retryActivities.length === 0) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const retryPlan = buildExecutionPlan(retryActivities, `${plan.title} · 重试`, peopleCount, {
      city: plan.city,
      travelMode,
    });
    executionRunStartedAtRef.current = Date.now();
    const runningRetryPlan = { ...retryPlan, status: 'running' as const };
    executionPlanRef.current = runningRetryPlan;
    setExecutionPlan(runningRetryPlan);
    commitExecutionRun(
      createExecutionRun(runningRetryPlan, {
        planId: plan.id,
        status: 'running',
        answer: `正在重试 ${retryActivities.map((activity) => activity.title).join('、')}`,
        startedAt: executionRunStartedAtRef.current,
      })
    );
    setAgentResult({
      answer: `正在重试 ${retryActivities.map((activity) => activity.title).join('、')}`,
      steps: [],
      totalToolCalls: retryPlan.calls.length,
      successCount: 0,
      failCount: 0,
    });
    setAgentSteps([]);
    setIsExecuting(true);

    const result = await agentExecute(
      {
        planId: plan.id,
        activities: retryActivities,
        planTitle: plan.title,
        city: plan.city || '北京',
        peopleCount,
        onStep: (step) => {
          setAgentSteps((prev) => [...prev.filter((item) => item.id !== step.id), step]);
          if (step.type !== 'tool_result') return;
          setExecutionPlan((prev) => {
            if (!prev) return prev;
            const nextCalls = [...prev.calls];
            const targetIndex = findCallIndex(nextCalls, step);

            if (targetIndex >= 0) {
              nextCalls[targetIndex] = {
                ...nextCalls[targetIndex],
                tool: (step.toolName || nextCalls[targetIndex].tool) as ToolName,
                label: buildToolLabel(step.toolName, step.toolArgs),
                icon: buildToolIconName(step.toolName),
                input: step.toolArgs || nextCalls[targetIndex].input,
                status: step.status,
                result: step.toolResult,
                error: step.status === 'failed' ? step.toolResult?.message : undefined,
                finishedAt: step.finishedAt,
              };
            }

            const nextPendingIndex = nextCalls.findIndex((call) => call.status === 'pending');
            if (nextPendingIndex >= 0) {
              nextCalls[nextPendingIndex] = { ...nextCalls[nextPendingIndex], status: 'running' };
            }

            const nextPlan = { ...prev, calls: nextCalls };
            executionPlanRef.current = nextPlan;
            return nextPlan;
          });

          if (step.status === 'failed' && step.toolArgs) {
            const failedActivityName =
              typeof step.toolArgs.name === 'string'
                ? step.toolArgs.name
                : typeof step.toolArgs.to === 'string'
                  ? step.toolArgs.to
                  : '';

            if (failedActivityName) {
              const failedAct = retryActivities.find((act) => act.title === failedActivityName);
              if (failedAct) {
                abortController.abort();
                setExecutionPaused(true);
              }
            }
          }
        },
      },
      { signal: abortController.signal }
    );

    if (!mountedRef.current) return;

    if (result.isCancelled) {
      setAgentResult(result);
      const successfulBeforeCancel = retryActivities
        .filter((activity) =>
          result.steps.some(
            (step) =>
              step.type === 'tool_result' &&
              step.status === 'success' &&
              (step.toolName === 'make_reservation' || step.toolName === 'book_activity') &&
              step.toolArgs?.name === activity.title
          )
        )
        .map((activity) => activity.id);
      recordSuccessfulBookings(successfulBeforeCancel);
      const latestPlan = executionPlanRef.current || {
        ...retryPlan,
        status: 'partial_failed' as const,
      };
      commitExecutionRun(
        createExecutionRun(latestPlan, {
          planId: plan.id,
          status: 'cancelled',
          answer: result.answer,
          startedAt: executionRunStartedAtRef.current,
          completedAt: Date.now(),
        })
      );
      setIsExecuting(false);
      return;
    }

    const successIds = retryActivities
      .filter((activity) =>
        result.steps.some(
          (step) =>
            step.type === 'tool_result' &&
            step.status === 'success' &&
            (step.toolName === 'make_reservation' || step.toolName === 'book_activity') &&
            step.toolArgs?.name === activity.title
        )
      )
      .map((activity) => activity.id);

    recordSuccessfulBookings(successIds);

    setAgentResult(result);
    const completedAt = Date.now();
    const latestPlan = executionPlanRef.current;
    const finalExecutionPlan = latestPlan
      ? ({
          ...latestPlan,
          status: result.failCount > 0 ? 'partial_failed' : 'completed',
          completedAt,
        } as ExecutionPlan)
      : null;
    if (finalExecutionPlan) {
      executionPlanRef.current = finalExecutionPlan;
      setExecutionPlan(finalExecutionPlan);
      commitExecutionRun(
        createExecutionRun(finalExecutionPlan, {
          planId: plan.id,
          status: result.failCount > 0 ? 'partial_failed' : 'completed',
          answer: result.answer,
          startedAt: executionRunStartedAtRef.current,
          completedAt,
        })
      );
    }
    setIsExecuting(false);
  }, [
    agentResult,
    executionPlan,
    isExecuting,
    recordSuccessfulBookings,
    plan,
    peopleCount,
    selectedActivities,
    travelMode,
    handleCancel,
  ]);

  // 将 handleRetryFailedExecution 赋值给 ref，以便在 handleFailureAction 中使用
  retryExecutionRef.current = handleRetryFailedExecution;

  const handleModeChange = useCallback(
    (newMode: TravelMode) => {
      setTravelMode(newMode);
      const modeMap = activeVariantRouteMaps[newMode];
      if (modeMap) {
        setRouteMap(modeMap);
        setRouteSegments(modeMap.segments || []);
      }
    },
    [activeVariantRouteMaps, setTravelMode]
  );

  const handlePrimaryExecute = useCallback(() => {
    if (!plan || selectedActivities.length === 0 || isExecuting) return;
    if (executionPlanRef.current?.status === 'running') return;
    const routeDistanceKm = Number(routeMap?.totalDistanceKm || 0);
    const routeDurationMin = routeMap?.totalDurationMin || 0;
    const hasRouteRisk = routeDistanceKm > 300 || routeDurationMin > 720;
    if ((readiness && readiness.status !== 'ready') || hasRouteRisk) {
      const warning = hasRouteRisk
        ? `路线跨度异常（约 ${routeDistanceKm.toFixed(1)} 公里，${routeDurationMin} 分钟），请确认城市和点位后再执行。`
        : readiness?.summary || '这条路线存在执行风险。';
      const basePlan = buildExecutionPlan(selectedActivities, plan.title, peopleCount, {
        city: plan.city,
        travelMode,
      });
      const pendingPlan = { ...basePlan, status: 'pending' as const };
      executionPlanRef.current = pendingPlan;
      setExecutionPlan(pendingPlan);
      commitExecutionRun(
        createExecutionRun(pendingPlan, {
          planId: plan.id,
          status: 'idle',
          answer: `提醒：${warning} 你仍然可以确认执行，或先在管家里微调。`,
        })
      );
      setAgentResult({
        answer: `提醒：${warning} 你仍然可以确认执行，或先在管家里微调。`,
        steps: [],
        totalToolCalls: 0,
        successCount: 0,
        failCount: 0,
      });
      setShowConfirmExecute(true);
      return;
    }
    setShowConfirmExecute(true);
  }, [plan, selectedActivities, isExecuting, readiness, peopleCount, routeMap, travelMode]);
  if (!plan) return null;

  const compactTitle = plan.title.length > 20 ? `${plan.title.slice(0, 20)}...` : plan.title;

  return (
    <div className="flex h-full flex-col bg-transparent relative overflow-hidden rounded-inherit">
      {!hideHeader && (
        <div className="absolute top-0 left-0 right-0 z-30 pt-12 pb-4 px-5 bg-gradient-to-b from-black/52 via-black/18 to-transparent flex items-start justify-between pointer-events-none">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/92 backdrop-blur-xl rounded-full flex items-center justify-center shadow-[0_12px_28px_rgba(20,24,33,0.12)] pointer-events-auto active:scale-95 transition-transform border border-white/70"
            aria-label="返回"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--app-ink)]" strokeWidth={2.5} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 px-3 pt-1 drop-shadow-lg pointer-events-auto min-w-0">
            <XiaoMeiAvatar mood="smile" size="w-6 h-6" />
            <span className="font-bold text-[15px] text-white tracking-wide line-clamp-1 text-center max-w-[200px]">
              {compactTitle}
            </span>
          </div>
          {onShare ? (
            <button
              onClick={onShare}
              className="w-10 h-10 bg-white/92 backdrop-blur-xl rounded-full flex items-center justify-center shadow-[0_12px_28px_rgba(20,24,33,0.12)] pointer-events-auto border border-white/70 active:scale-95 transition-transform"
              aria-label="分享"
            >
              <Share2 className="w-4 h-4 text-[var(--app-ink)]" />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-none pb-6">
        <MapPanel
          plan={displayPlan || plan}
          travelMode={travelMode}
          routeMap={routeMap}
          onActivityClick={onActivityClick}
        />

        <div className="relative z-10 bg-transparent rounded-t-[28px] px-4 pt-6 pb-28 space-y-5">
          <MultiRouteSelector
            activeMode={travelMode}
            routes={activeVariantRouteResults}
            loading={activeVariantRouteLoading}
            errors={activeVariantRouteErrors}
            onSelectMode={handleModeChange}
          />

          {isStreaming ? (
            <div className="relative">
              <div className="absolute left-[19px] top-10 bottom-4 w-[2px] bg-gradient-to-b from-[var(--sky-ink)] via-[var(--sky-strong)] to-transparent z-0"></div>

              {streamingActivities.length === 0 && displayActivities.length > 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="w-10 h-10 bg-gray-200 animate-pulse rounded-full mb-3" />
                  <div className="text-[13px] font-bold text-[var(--app-text-soft)]">
                    AI 正在为你生成行程...
                  </div>
                  <div className="mt-1 text-[13px] font-bold text-[var(--app-text-soft)]">
                    每个活动都在精心挑选中
                  </div>
                </div>
              )}

              {streamingActivities.filter(Boolean).map((activity, index) => {
                const segment = routeSegments.length > index ? routeSegments[index] : null;
                return (
                  <div
                    key={`activity-${index}-${activity.id || activity.title}`}
                    className="relative z-10 mb-4"
                  >
                    {segment && (
                      <div className="mb-2">
                        <TravelSegmentCard
                          segment={segment}
                          travelMode={travelMode}
                          isCompact={true}
                        />
                      </div>
                    )}
                    <ActivityCard
                      activity={activity}
                      index={index + 1}
                      variant="default"
                      isSelected={selectedIds.has(activity.id)}
                      isBooked={bookedIds.has(activity.id)}
                      isEmphasized={(plan.uiStrategy?.emphasis || []).includes(activity.id)}
                      travelTime={index > 0 ? (actualDurations.get(index) ?? undefined) : undefined}
                      onActivityClick={onActivityClick}
                      onToggleSelect={onToggleSelect || (() => {})}
                    />
                  </div>
                );
              })}

              {streamingActivities.length > 0 && routeMap?.homeLocation && (
                <>
                  {(() => {
                    const lastSegment =
                      routeSegments.length > streamingActivities.length
                        ? routeSegments[routeSegments.length - 1]
                        : null;
                    if (lastSegment) {
                      return (
                        <div className="mb-2">
                          <TravelSegmentCard
                            segment={lastSegment}
                            travelMode={travelMode}
                            isCompact={true}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}

              {Array.from({
                length: Math.max(0, displayActivities.length - streamingActivities.length),
              }).map((_, i) => (
                <div
                  key={`skeleton-${streamingActivities.length + i}`}
                  className="relative z-10 mb-4"
                >
                  <ActivityCardSkeleton />
                </div>
              ))}

              <div className="relative z-10 flex items-center mt-2">
                <div className="w-10 flex justify-center shrink-0">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--mint-ink)] ring-4 ring-[#F5F5F7]">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                </div>
                <div className="flex-1 flex items-center ml-1">
                  <div className="h-[1px] flex-1 bg-gray-200/60 mr-3"></div>
                  <span className="text-[11px] font-bold text-[var(--mint-ink)]">行程结束</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {displayPlan && getDayCount(displayPlan) > 1 && (
                <MultiDayTabs
                  plan={displayPlan}
                  activeDayIndex={activeDayIndex}
                  onDayChange={setActiveDayIndex}
                />
              )}
              {/* 预算版本切换 */}
              {budgetOptions.length > 1 && (
                <div className="px-5 mb-4">
                  <div className="flex gap-1.5">
                    {budgetOptions.map((opt, idx) => {
                      const isSelected = idx === selectedBudgetIdx;
                      const isRecommended = idx === 1;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => {
                            setSelectedBudgetIdx(idx);
                            const nextVariant = variants[idx];
                            if (nextVariant) {
                              setActiveVariantId(nextVariant.id);
                              const nextMap =
                                variantRouteMaps[nextVariant.id]?.[travelMode] || null;
                              setRouteMap(nextMap);
                              setRouteSegments(nextMap?.segments || []);
                            }
                          }}
                          className={`relative flex-1 rounded-2xl py-2 px-2 text-center transition-all active:scale-95 ${
                            isSelected
                              ? 'bg-[var(--app-ink)] text-white shadow-md'
                              : 'bg-white/80 text-[var(--app-ink)] border border-[var(--app-border)] hover:border-gray-300'
                          }`}
                        >
                          {isRecommended && (
                            <div
                              className={`absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-bold px-1.5 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-white text-[var(--app-ink)]'
                                  : 'bg-[var(--app-ink)] text-white'
                              }`}
                            >
                              推荐
                            </div>
                          )}
                          <div className="text-[10px] font-bold">{opt.label}</div>
                          <div
                            className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-[var(--app-ink)]'}`}
                          >
                            ¥{opt.perPerson}
                            <span className="text-[8px] opacity-70">/人</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <ActivityTimeline
                activities={timelineActivities}
                uiVariant={'default' as UIVariant}
                selectedIds={selectedIds}
                bookedIds={bookedIds}
                emphasizedIds={plan.uiStrategy?.emphasis || []}
                actualDurations={actualDurations}
                onActivityClick={onActivityClick}
                onToggleSelect={onToggleSelect || (() => {})}
                onUpdatePlan={onUpdatePlan ? handleUpdateActivities : undefined}
                homeLocation={routeMap?.homeLocation}
                routeSegments={routeSegments}
                travelMode={travelMode}
                onBookTaxi={handleBookTaxi}
              />
            </>
          )}
        </div>
      </div>

      <BottomActionBar
        selectedCount={selectedActivities.length}
        hasBooked={hasBookedActivities && !executionPlan}
        isExecuting={isExecuting}
        isCompleted={isPlanCompleted}
        executeButtonLabel={executeButtonLabel}
        travelMode={travelMode}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onExecute={handlePrimaryExecute}
        onCancel={handleCancel}
        onProceedPayment={onProceedPayment}
      />

      <CopilotPanel
        plan={plan}
        isOpen={isCopilotOpen}
        onClose={() => {
          setIsCopilotOpen(false);
          setCopilotInitialMessage(undefined);
        }}
        onUpdatePlan={onUpdatePlan}
        shareSlug={plan?.shareSlug}
        readiness={readiness}
        selectedActivities={selectedActivities}
        isExecuting={isExecuting}
        profiles={profiles}
        onExecute={() => {
          setIsCopilotOpen(false);
          handlePrimaryExecute();
        }}
        onStartCollaboration={() => {
          setIsCopilotOpen(false);
          onNavigate?.('collaborate');
        }}
        initialMessage={copilotInitialMessage}
      />

      <ExecutionPanel
        executionPlan={executionPlan}
        executionRun={executionRun}
        isExecuting={isExecuting}
        isPaused={executionPaused}
        agentResult={agentResult}
        onClose={() => {
          executionPlanRef.current = null;
          setExecutionPlan(null);
          setExecutionPaused(false);
        }}
        onProceedPayment={onProceedPayment}
        onRetryFailed={() => void handleRetryFailedExecution()}
        onContinue={handleContinueFromFailure}
        onCancel={handleCancel}
        onAskCopilot={(failedGroups) => {
          const failureDetails = failedGroups
            .map((g) => {
              const failedCall = g.calls.find((c) => c.status === 'failed');
              const toolName = failedCall?.label || g.title;
              const errorMsg =
                failedCall?.error || failedCall?.result?.message || g.summary || '未知错误';
              const timeRange = failedCall?.input?.timeRange || '';
              const peopleCount = failedCall?.input?.peopleCount || '';
              return [
                `❌ ${g.title}`,
                timeRange ? `  时间：${timeRange}` : '',
                peopleCount ? `  人数：${peopleCount}` : '',
                `  原因：${errorMsg}`,
                `  工具：${toolName}`,
              ]
                .filter(Boolean)
                .join('\n');
            })
            .join('\n\n');
          const currentPlanSummary = displayPlan
            ? `当前行程：${displayPlan.title}\n活动：${displayPlan.activities.map((a) => a.title).join(' → ')}`
            : '';
          const message = `我在执行预订时遇到了问题，请帮我调整行程：\n\n${failureDetails}\n\n${currentPlanSummary}\n\n请推荐替代方案并直接修改行程。`;
          setCopilotInitialMessage(message);
          setIsCopilotOpen(true);
          setExecutionPlan(null);
        }}
        alternatives={executionAlternatives}
        onSelectAlternative={(groupId, alternative) => {
          // 处理选择替代商家
          console.log('[Itinerary] Selected alternative:', groupId, alternative);
          // TODO: 实现替换逻辑
        }}
      />

      {showConfirmExecute && !isExecuting && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmExecute(false)}
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white px-5 pt-6 pb-10 shadow-[0_-16px_40px_rgba(0,0,0,0.12)]"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-bold text-[var(--app-ink)]">确认一键执行</h3>
              <button
                onClick={() => setShowConfirmExecute(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--app-card-soft)]"
              >
                <XCircle className="w-5 h-5 text-[var(--app-text-soft)]" />
              </button>
            </div>
            <p className="text-[13px] text-[var(--app-text)] mb-4">
              即将为 {peopleCount} 人执行以下 {selectedActivities.length} 项 AI 预订：
            </p>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {selectedActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--app-card-soft)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[var(--app-ink)] truncate">
                      {act.title}
                    </div>
                    <div className="text-[11px] text-[var(--app-text-soft)] truncate">
                      {act.timeLine || act.description}
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[var(--mint-ink)] shrink-0 ml-2">
                    ¥{act.price}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--mint-soft)] px-4 py-3 mb-5">
              <span className="text-[13px] font-bold text-[var(--mint-ink)]">预估总价</span>
              <span className="text-[18px] font-bold text-[var(--mint-ink)]">
                ¥{selectedActivities.reduce((sum, a) => sum + a.price, 0)}
              </span>
            </div>
            <p className="text-[11px] leading-5 text-[var(--app-text-soft)] mb-4">
              执行仅锁定可预订名额，确认结果后再统一付款。实际取消与退款规则以商家页面为准。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmExecute(false)}
                className="flex-1 py-3.5 bg-[var(--app-card-soft)] rounded-2xl text-[13px] font-bold text-[var(--app-text)] active:scale-[0.98] transition-transform"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowConfirmExecute(false);
                  void handleExecute();
                }}
                className="flex-1 app-btn-primary py-3.5 rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-transform"
              >
                确认执行
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function Itinerary(props: ItineraryProps) {
  return (
    <DataModelProvider initialPlan={props.plan ?? undefined}>
      <ItineraryInner {...props} />
    </DataModelProvider>
  );
}
