import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ChevronUp, ChevronDown, Car, Crosshair } from 'lucide-react';
import { TRAVEL_MODE_META } from '../../config/travelModes';
import { htmlEscape } from '../../utils/htmlEscape';
import type { RoutePlanningResult } from '../../services/routePlanning';
import { loadAmapScript, type AMapScriptGlobal } from '../../services/amapWeb';
import type { RouteSegment } from '../../types';
import type { MapPanelProps } from './types';

interface AMapInstance {
  remove(target: unknown): void;
  add(target: unknown): void;
  setFitView(overlays?: unknown[], immediately?: boolean, padding?: number[]): void;
  resize(): void;
  destroy(): void;
  addControl(control: unknown): void;
  setCenter(lnglat: [number, number]): void;
  setZoom(zoom: number): void;
  on?(event: string, callback: (...args: unknown[]) => void): void;
  off?(event: string, callback: (...args: unknown[]) => void): void;
}

interface AMapMarker {
  on(event: string, callback: () => void): void;
}

interface TrafficLayerInstance {
  show?: () => void;
  hide?: () => void;
}

interface AMapStatic extends AMapScriptGlobal {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Pixel: new (x: number, y: number) => { x: number; y: number };
  Polyline: new (options: Record<string, unknown>) => unknown;
  Scale?: new () => unknown;
  TileLayer?: {
    Traffic?: new (options?: Record<string, unknown>) => TrafficLayerInstance;
  };
}

type MapRenderMode = 'loading' | 'interactive' | 'static' | 'fallback';

const AMAP_REST_KEY = import.meta.env.VITE_AMAP_KEY as string | undefined;
const AMAP_USE_PROXY =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_AMAP_USE_PROXY !== 'false';
const AMAP_PROXY_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AMAP_PROXY_HOST) || '/api/amap';
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLngLat(
  location?: { lng: unknown; lat: unknown } | null
): { lng: number; lat: number } | null {
  if (!location) return null;
  const lng = toFiniteNumber(location.lng);
  const lat = toFiniteNumber(location.lat);
  if (lng === null || lat === null) return null;
  return { lng, lat };
}

function normalizeLngLatTuple(point?: [unknown, unknown] | null): [number, number] | null {
  if (!point) return null;
  const lng = toFiniteNumber(point[0]);
  const lat = toFiniteNumber(point[1]);
  if (lng === null || lat === null) return null;
  return [lng, lat];
}

function compactPath(path: Array<[unknown, unknown] | null | undefined>): [number, number][] {
  return path
    .map((point) => normalizeLngLatTuple(point ?? null))
    .filter((point): point is [number, number] => point !== null);
}

function isContainerReady(container: HTMLDivElement | null): boolean {
  if (!container) return false;
  return container.clientWidth > 0 && container.clientHeight > 0;
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForContainerReady(
  container: HTMLDivElement | null,
  maxFrames = 12
): Promise<boolean> {
  for (let index = 0; index < maxFrames; index += 1) {
    if (isContainerReady(container)) return true;
    await waitForAnimationFrame();
  }
  return isContainerReady(container);
}

function parsePolyline(polyline?: string): [number, number][] {
  if (!polyline) return [];
  return polyline
    .split(';')
    .map((coord) => coord.trim())
    .filter(Boolean)
    .map((coord) => {
      const [lng, lat] = coord.split(',').map(Number);
      return Number.isFinite(lng) && Number.isFinite(lat) ? ([lng, lat] as [number, number]) : null;
    })
    .filter((coord): coord is [number, number] => coord !== null);
}

function appendPath(target: [number, number][], nextPath: [number, number][]) {
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

function buildSegmentPath(segment: RouteSegment): [number, number][] {
  const polylinePath = parsePolyline(segment.polyline);
  if (polylinePath.length > 1) return polylinePath;
  return compactPath([
    [segment.from.lng, segment.from.lat],
    [segment.to.lng, segment.to.lat],
  ]);
}

function buildDerivedRouteGuide(
  routeMap: MapPanelProps['routeMap'],
  travelMode: MapPanelProps['travelMode']
): RoutePlanningResult | null {
  if (!routeMap?.segments?.length) return null;
  return {
    totalTime: routeMap.segments.reduce((sum, segment) => sum + (segment.duration || 0), 0),
    totalDistance: routeMap.segments.reduce((sum, segment) => sum + (segment.distance || 0), 0),
    segments: routeMap.segments.map((segment) => ({
      mode: segment.mode || travelMode,
      path: parsePolyline(segment.polyline),
      distance: segment.distance || 0,
      time: segment.duration || 0,
      instruction: segment.instruction || `${segment.from?.name || ''} → ${segment.to?.name || ''}`,
      steps: segment.steps || [],
      transitDetails: segment.transitDetails,
      transfers: segment.transfers,
      walkingDistance: segment.walkingDistance,
    })),
  };
}

function buildRoutePath(
  routeMap: MapPanelProps['routeMap'],
  routeGuide: RoutePlanningResult | null
): [number, number][] {
  if (routeGuide?.segments.length) {
    const guidePath: [number, number][] = [];
    routeGuide.segments.forEach((segment) => {
      if (!segment.path?.length) return;
      appendPath(guidePath, compactPath(segment.path));
    });
    if (guidePath.length > 1) return guidePath;
  }

  if (routeMap?.segments?.length) {
    const segmentPath: [number, number][] = [];
    routeMap.segments.forEach((segment) => appendPath(segmentPath, buildSegmentPath(segment)));
    if (segmentPath.length > 1) return segmentPath;
  }

  if (!routeMap) return [];
  const home = normalizeLngLat(routeMap.homeLocation);
  const points = routeMap.points
    .map((point) => normalizeLngLat(point.location))
    .filter((point): point is { lng: number; lat: number } => point !== null);

  return home
    ? compactPath([
        [home.lng, home.lat],
        ...points.map((point) => [point.lng, point.lat] as [number, number]),
        [home.lng, home.lat],
      ])
    : compactPath(points.map((point) => [point.lng, point.lat] as [number, number]));
}

function buildTransitBadges(
  segments: RouteSegment[] | undefined
): Array<{ label: string; position: [number, number] }> {
  if (!segments) return [];

  return segments.flatMap((segment) => {
    if (!segment.transitDetails?.length) return [];
    const points = buildSegmentPath(segment);
    const midpoint =
      points[Math.floor(points.length / 2)] ??
      normalizeLngLatTuple([segment.from.lng, segment.from.lat]);
    if (!midpoint) return [];
    return segment.transitDetails.slice(0, 1).map((detail) => ({
      label: detail.lineName,
      position: midpoint,
    }));
  });
}

function getPreferredCenter(routeMap: MapPanelProps['routeMap']): [number, number] {
  const home = normalizeLngLat(routeMap?.homeLocation);
  if (home) return [home.lng, home.lat];

  const firstPoint = routeMap?.points
    .map((point) => normalizeLngLat(point.location))
    .find((point) => point !== null);

  return firstPoint ? [firstPoint.lng, firstPoint.lat] : [116.397428, 39.90923];
}

function shouldRenderPlannedPolyline(
  routeMap: MapPanelProps['routeMap'],
  _travelMode: MapPanelProps['travelMode']
): routeMap is NonNullable<MapPanelProps['routeMap']> {
  if (!routeMap || !routeMap.routeSource || routeMap.routeSource === 'draft') return false;
  return Boolean(routeMap.segments?.length);
}

export default function MapPanel({ plan, travelMode, routeMap, onActivityClick }: MapPanelProps) {
  const [mapExpanded, setMapExpanded] = useState(true);
  const [showTraffic, setShowTraffic] = useState(false);
  const [mapRenderMode, setMapRenderMode] = useState<MapRenderMode>('loading');
  const [legendVisible, setLegendVisible] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const amapInstanceRef = useRef<AMapInstance | null>(null);
  const amapMarkersRef = useRef<unknown[]>([]);
  const amapTransitBadgeRef = useRef<unknown[]>([]);
  const amapPolylineRef = useRef<unknown | null>(null);
  const amapTrafficRef = useRef<TrafficLayerInstance | null>(null);
  const legendTimerRef = useRef<number | null>(null);
  const renderRequestIdRef = useRef(0);
  const latestPlanRef = useRef(plan);
  const latestOnActivityClickRef = useRef(onActivityClick);

  const derivedRouteGuide = useMemo(
    () => buildDerivedRouteGuide(routeMap, travelMode),
    [routeMap, travelMode]
  );

  useEffect(() => {
    latestPlanRef.current = plan;
  }, [plan]);

  useEffect(() => {
    latestOnActivityClickRef.current = onActivityClick;
  }, [onActivityClick]);

  const clearLegendTimer = useCallback(() => {
    if (legendTimerRef.current !== null) {
      window.clearTimeout(legendTimerRef.current);
      legendTimerRef.current = null;
    }
  }, []);

  const scheduleLegendHide = useCallback(
    (delay = 2400) => {
      clearLegendTimer();
      legendTimerRef.current = window.setTimeout(() => {
        setLegendVisible(false);
        setLegendExpanded(false);
        legendTimerRef.current = null;
      }, delay);
    },
    [clearLegendTimer]
  );

  const revealLegend = useCallback(
    (expanded = false) => {
      setLegendVisible(true);
      setLegendExpanded(expanded);
      scheduleLegendHide(expanded ? 4200 : 2400);
    },
    [scheduleLegendHide]
  );

  const toggleLegendExpanded = useCallback(() => {
    setLegendVisible(true);
    setLegendExpanded((prev) => {
      const next = !prev;
      scheduleLegendHide(next ? 4200 : 2400);
      return next;
    });
  }, [scheduleLegendHide]);

  const legendClickHandler = useCallback(() => {
    revealLegend(false);
  }, [revealLegend]);

  const clearMapOverlays = useCallback((map: AMapInstance) => {
    amapMarkersRef.current.forEach((marker) => {
      try {
        map.remove(marker);
      } catch (_) {}
    });
    amapTransitBadgeRef.current.forEach((marker) => {
      try {
        map.remove(marker);
      } catch (_) {}
    });
    if (amapPolylineRef.current) {
      try {
        map.remove(amapPolylineRef.current);
      } catch (_) {}
    }
    amapMarkersRef.current = [];
    amapTransitBadgeRef.current = [];
    amapPolylineRef.current = null;
  }, []);

  useEffect(() => {
    let disposed = false;
    const renderRequestId = renderRequestIdRef.current + 1;
    renderRequestIdRef.current = renderRequestId;

    async function syncMap() {
      const isStale = () => disposed || renderRequestIdRef.current !== renderRequestId;

      if (!routeMap || routeMap.points.length === 0 || !mapContainerRef.current) {
        setMapRenderMode('fallback');
        return;
      }

      let AMap: AMapStatic | null = null;
      try {
        AMap = (await loadAmapScript(['AMap.Scale'])) as AMapStatic | null;
      } catch (error) {
        console.warn('[MapPanel] failed to load map script:', error);
      }

      if (!AMap || isStale() || !mapContainerRef.current) {
        setMapRenderMode(AMAP_REST_KEY || AMAP_USE_PROXY ? 'static' : 'fallback');
        return;
      }

      const container = mapContainerRef.current;
      const containerReady = await waitForContainerReady(container);
      if (!containerReady || isStale() || !container) {
        window.setTimeout(() => {
          if (!isStale()) {
            setMapRenderMode((prev) => (prev === 'interactive' ? prev : 'loading'));
          }
        }, 120);
        return;
      }

      if (!amapInstanceRef.current) {
        try {
          amapInstanceRef.current = new AMap.Map(container, {
            viewMode: '3D',
            zoom: 13,
            pitch: 0,
            rotation: 0,
            zoomEnable: true,
            dragEnable: true,
            pitchEnable: false,
            rotateEnable: false,
          });
          amapInstanceRef.current.on?.('click', legendClickHandler);
          if (AMap.Scale) {
            amapInstanceRef.current.addControl(new AMap.Scale());
          }
        } catch (error) {
          console.warn('[MapPanel] failed to create map instance:', error);
          setMapRenderMode(AMAP_REST_KEY || AMAP_USE_PROXY ? 'static' : 'fallback');
          return;
        }
      }

      const map = amapInstanceRef.current;
      if (!map) return;

      await waitForAnimationFrame();
      await waitForAnimationFrame();
      if (isStale()) return;

      try {
        map.resize();
        map.setCenter(getPreferredCenter(routeMap));
      } catch (error) {
        console.warn('[MapPanel] failed to resize/center map:', error);
      }

      const renderOverlays = () => {
        clearMapOverlays(map);
        const overlays: unknown[] = [];

        const home = normalizeLngLat(routeMap.homeLocation);
        if (home) {
          const homeMarker = new AMap.Marker({
            position: [home.lng, home.lat],
            offset: new AMap.Pixel(-16, -16),
            content:
              '<div style="width:32px;height:32px;border-radius:999px;background:#f97316;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,.15);border:3px solid rgba(255,255,255,.95)">家</div>',
          });
          map.add(homeMarker);
          amapMarkersRef.current.push(homeMarker);
          overlays.push(homeMarker);
        }

        routeMap.points.forEach((point, index) => {
          const normalized = normalizeLngLat(point.location);
          if (!normalized) return;
          const marker = new AMap.Marker({
            position: [normalized.lng, normalized.lat],
            offset: new AMap.Pixel(-16, -16),
            content: `<div style="width:32px;height:32px;border-radius:999px;background:#3b82f6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,.15);border:3px solid rgba(255,255,255,.95)">${htmlEscape(String(index + 1))}</div>`,
          });
          marker.on('click', () => {
            const activity = latestPlanRef.current?.activities.find(
              (item) => item.id === (point.activityId || point.id)
            );
            if (activity) latestOnActivityClickRef.current(activity);
          });
          map.add(marker);
          amapMarkersRef.current.push(marker);
          overlays.push(marker);
        });

        if (travelMode === 'transit') {
          buildTransitBadges(routeMap.segments).forEach((badge) => {
            const marker = new AMap.Marker({
              position: badge.position,
              offset: new AMap.Pixel(-28, -14),
              content: `<div style="padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.96);color:#ea580c;font-size:11px;font-weight:800;box-shadow:0 6px 16px rgba(0,0,0,.12);border:1px solid rgba(251,146,60,.35);white-space:nowrap;">${htmlEscape(badge.label)}</div>`,
            });
            map.add(marker);
            amapTransitBadgeRef.current.push(marker);
            overlays.push(marker);
          });
        }

        return overlays;
      };

      let overlays: unknown[] = [];
      try {
        overlays = renderOverlays();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Pixel(NaN, NaN)')) {
          await waitForAnimationFrame();
          await waitForAnimationFrame();
          if (isStale()) return;
          try {
            map.resize();
            overlays = renderOverlays();
          } catch (retryError) {
            console.warn('[MapPanel] overlay retry failed:', retryError, {
              containerWidth: container.clientWidth,
              containerHeight: container.clientHeight,
              center: getPreferredCenter(routeMap),
              pointCount: routeMap.points.length,
              homeLocation: routeMap.homeLocation,
            });
          }
        } else {
          console.warn('[MapPanel] failed to render overlays:', error);
        }
      }

      const shouldRenderPolyline = shouldRenderPlannedPolyline(routeMap, travelMode);
      if (shouldRenderPolyline) {
        const polylinePath = compactPath(buildRoutePath(routeMap, derivedRouteGuide));
        if (polylinePath.length > 1) {
          const isTransitRoute = travelMode === 'transit';
          amapPolylineRef.current = new AMap.Polyline({
            path: polylinePath,
            strokeColor: TRAVEL_MODE_META[travelMode].color,
            strokeWeight: isTransitRoute ? 6 : TRAVEL_MODE_META[travelMode].strokeWeight,
            strokeOpacity: isTransitRoute ? 0.98 : 0.95,
            lineJoin: 'round',
            lineCap: 'round',
            strokeStyle: isTransitRoute ? 'solid' : TRAVEL_MODE_META[travelMode].lineStyle,
            showDir: travelMode === 'driving' || travelMode === 'taxi' || travelMode === 'cycling',
          });
          map.add(amapPolylineRef.current);
          overlays.push(amapPolylineRef.current);
        }
      }

      console.info('[MapPanel][RouteRender]', {
        mode: travelMode,
        routeSource: routeMap.routeSource,
        officialEligible: false,
        officialSuccess: false,
        polylineRendered: shouldRenderPolyline,
        segmentCount: routeMap.segments?.length || 0,
      });

      if (isStale()) return;

      if (overlays.length > 0) {
        window.setTimeout(() => {
          if (!isStale() && amapInstanceRef.current) {
            try {
              amapInstanceRef.current.setFitView(overlays, false, [56, 84, 56, 126]);
            } catch (error) {
              console.warn('[MapPanel] failed to fit view:', error);
            }
          }
        }, 150);
      }

      setMapRenderMode('interactive');
    }

    void syncMap();

    return () => {
      disposed = true;
    };
  }, [clearMapOverlays, derivedRouteGuide, legendClickHandler, routeMap, travelMode]);

  useEffect(() => {
    let disposed = false;

    async function syncTrafficLayer() {
      if (!amapInstanceRef.current || mapRenderMode !== 'interactive') return;
      const AMap = (await loadAmapScript()) as AMapStatic | null;
      if (!AMap?.TileLayer?.Traffic || disposed || !amapInstanceRef.current) return;

      if (!amapTrafficRef.current) {
        amapTrafficRef.current = new AMap.TileLayer.Traffic({
          autoRefresh: true,
          interval: 180,
        });
      }

      if (showTraffic) {
        amapTrafficRef.current.show?.();
        amapInstanceRef.current.add(amapTrafficRef.current as unknown);
      } else {
        amapTrafficRef.current.hide?.();
        amapInstanceRef.current.remove(amapTrafficRef.current as unknown);
      }
    }

    void syncTrafficLayer();

    return () => {
      disposed = true;
    };
  }, [mapRenderMode, showTraffic]);

  useEffect(() => {
    if (mapExpanded && amapInstanceRef.current) {
      window.setTimeout(() => {
        try {
          amapInstanceRef.current?.resize();
          const overlays = [
            ...amapMarkersRef.current,
            ...amapTransitBadgeRef.current,
            amapPolylineRef.current,
          ].filter(Boolean);
          amapInstanceRef.current?.setFitView(overlays, false, [56, 84, 56, 126]);
        } catch (_) {}
      }, 260);
    }
  }, [mapExpanded, routeMap?.routeSource]);

  useEffect(() => {
    return () => {
      clearLegendTimer();
      if (amapInstanceRef.current) {
        try {
          amapInstanceRef.current.off?.('click', legendClickHandler);
        } catch (_) {}
        try {
          amapInstanceRef.current.destroy();
        } catch (_) {}
      }
      amapMarkersRef.current = [];
      amapTransitBadgeRef.current = [];
      amapPolylineRef.current = null;
      amapTrafficRef.current = null;
      amapInstanceRef.current = null;
    };
  }, [clearLegendTimer, legendClickHandler]);

  const staticMapUrl = useMemo(() => {
    if ((!AMAP_REST_KEY && !AMAP_USE_PROXY) || !routeMap || routeMap.points.length === 0) return '';
    const path = compactPath(buildRoutePath(routeMap, derivedRouteGuide))
      .map((point) => `${point[0]},${point[1]}`)
      .join(';');
    if (!path) return '';
    const center =
      normalizeLngLat(routeMap.homeLocation) || normalizeLngLat(routeMap.points[0]?.location);
    const activityMarkers = routeMap.points
      .map((point, index) => {
        const normalized = normalizeLngLat(point.location);
        return normalized ? `mid,0x111827,${index + 1}:${normalized.lng},${normalized.lat}` : '';
      })
      .filter(Boolean)
      .join('|');
    const home = normalizeLngLat(routeMap.homeLocation);
    const homeMarker = home ? `|mid,0xF97316,家:${home.lng},${home.lat}` : '';
    const modeMeta = TRAVEL_MODE_META[travelMode];
    const hexColor = modeMeta.color.replace('#', '0x');
    const params = `size=750*500&scale=2&zoom=13&traffic=${showTraffic ? 1 : 0}&markers=${encodeURIComponent(activityMarkers + homeMarker)}&paths=8,${hexColor},0.95,,0.5:${path}&location=${center?.lng},${center?.lat}`;
    if (AMAP_USE_PROXY) {
      return `${API_BASE_URL || ''}${AMAP_PROXY_HOST}?path=${encodeURIComponent(`staticmap?${params}`)}`;
    }
    return `https://restapi.amap.com/v3/staticmap?key=${AMAP_REST_KEY}&${params}`;
  }, [derivedRouteGuide, routeMap, showTraffic, travelMode]);

  return (
    <div
      className="relative z-0 overflow-hidden transition-[height] duration-500"
      style={{ height: mapExpanded ? 380 : 236 }}
    >
      <div ref={mapContainerRef} className="h-full w-full" />

      {mapRenderMode === 'static' && staticMapUrl && (
        <img
          src={staticMapUrl}
          alt="路线地图"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      )}

      {mapRenderMode === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
          <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            <span className="text-[13px] font-bold text-gray-600">正在加载地图</span>
          </div>
        </div>
      )}

      {mapRenderMode === 'fallback' && (
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute inset-x-6 top-24 rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_10px_32px_rgba(15,23,42,0.06)] backdrop-blur-md">
            <div className="text-[13px] font-bold text-gray-900">地图暂未连上</div>
            <div className="mt-1 text-[11px] font-bold leading-relaxed text-gray-500">
              先看路线与点位信息，也可以继续调整或执行。
            </div>
          </div>
        </div>
      )}

      {routeMap && routeMap.points.length > 0 && (
        <div
          className={`absolute bottom-4 left-3 z-20 max-w-[calc(100%-132px)] transition-all duration-300 ${legendVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
        >
          <div
            className={`overflow-hidden rounded-[24px] border border-white/75 bg-white/52 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-all duration-300 ${legendExpanded ? 'px-3 py-3' : 'px-2.5 py-2'}`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLegendExpanded}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/72 text-gray-700 shadow-sm transition-transform active:scale-95"
                aria-label={legendExpanded ? '收起图例' : '展开图例'}
              >
                {legendExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </button>
              <span className="text-[10px] font-bold tracking-[0.08em] text-gray-500">
                地图图例
              </span>
            </div>

            <div
              className={`grid transition-all duration-300 ${legendExpanded ? 'grid-rows-[1fr] pt-2 opacity-100' : 'grid-rows-[0fr] pt-0 opacity-0'}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2">
                  {routeMap.homeLocation && (
                    <div className="flex items-center gap-1.5 rounded-full bg-white/72 px-2.5 py-1.5">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f97316] text-[8px] font-bold text-white shadow-sm">
                        家
                      </div>
                      <span className="text-[10px] font-bold text-gray-700">当前位置</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 rounded-full bg-white/72 px-2.5 py-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3b82f6] text-[8px] font-bold text-white shadow-sm">
                      1
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">点位</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-white/72 px-2.5 py-1.5">
                    <div
                      className="h-[3px] w-5 rounded-full"
                      style={{
                        backgroundColor: TRAVEL_MODE_META[travelMode].color,
                        borderStyle:
                          TRAVEL_MODE_META[travelMode].lineStyle === 'dashed' ? 'dashed' : 'solid',
                      }}
                    />
                    <span className="text-[10px] font-bold text-gray-700">
                      {TRAVEL_MODE_META[travelMode].shortLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-[#f6f7fb]" />

      <div className="absolute right-4 bottom-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setShowTraffic((prev) => !prev)}
          className={`app-pill flex h-10 items-center gap-1.5 rounded-full px-4 backdrop-blur-xl active:scale-95 ${showTraffic ? 'bg-orange-500/20' : 'bg-white/80'}`}
        >
          <Car className={`h-4 w-4 ${showTraffic ? 'text-orange-500' : 'text-gray-500'}`} />
          <span
            className={`text-[13px] font-bold ${showTraffic ? 'text-orange-600' : 'text-gray-600'}`}
          >
            实时
          </span>
        </button>

        <button
          onClick={() => setMapExpanded((prev) => !prev)}
          className="app-pill flex h-10 items-center gap-1.5 rounded-full px-4 backdrop-blur-xl active:scale-95"
        >
          {mapExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-800" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-800" />
          )}
          <span className="text-[13px] font-bold text-gray-800">
            {mapExpanded ? '收起' : '展开'}
          </span>
        </button>

        <button
          onClick={() => {
            if (navigator.geolocation && amapInstanceRef.current) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lnglat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                  amapInstanceRef.current?.setCenter(lnglat);
                  amapInstanceRef.current?.setZoom(15);
                },
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
              );
            }
          }}
          className="app-pill flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-xl active:scale-95"
          title="定位到当前位置"
        >
          <Crosshair className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
