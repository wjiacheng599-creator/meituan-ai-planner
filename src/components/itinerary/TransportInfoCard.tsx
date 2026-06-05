import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TravelMode, TaxiDispatchRecommendation } from '../../types';
import type { RouteSegment } from '../../types';
import type { RoutePlanningResult } from '../../services/routePlanning';
import { TRAVEL_MODE_META } from '../../config/travelModes';
import RouteGuideCard from './RouteGuideCard';

function formatMeters(distance: number): string {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

function formatMoney(value?: number): string {
  if (!value || value <= 0) return '约 ¥0';
  return `约 ¥${Math.round(value)}`;
}

export interface TransportRouteMapData {
  totalDistanceKm: string;
  totalDurationMin: number;
  totalCost?: number;
  points: Array<{
    activityId: string;
    title: string;
    location: { lng: number; lat: number };
  }>;
  segments?: RouteSegment[];
}

export interface TransportInfoCardProps {
  travelMode: TravelMode;
  routeHeadline: { title: string; detail: string };
  activeTaxiRecommendation: TaxiDispatchRecommendation | null;
  routeMap: TransportRouteMapData | null;
  routeGuide?: RoutePlanningResult | null;
}

export default function TransportInfoCard({
  travelMode,
  routeHeadline,
  activeTaxiRecommendation,
  routeMap,
  routeGuide,
}: TransportInfoCardProps) {
  const [isGuideExpanded, setIsGuideExpanded] = useState(false);
  const activeModeMeta = TRAVEL_MODE_META[travelMode];
  const Icon = activeModeMeta.icon;

  const hasTransitGuide =
    routeGuide && routeGuide.segments.some((s) => s.transitDetails && s.transitDetails.length > 0);

  return (
    <div
      className="mt-3 rounded-[24px] border px-4 py-4"
      style={{ backgroundColor: activeModeMeta.bg, borderColor: activeModeMeta.border }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: '#ffffffcc', color: activeModeMeta.softText }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-gray-900">{routeHeadline.title}</div>
              <div
                className="mt-1 text-[11px] font-bold leading-relaxed"
                style={{ color: activeModeMeta.softText }}
              >
                {routeHeadline.detail}
              </div>
            </div>
          </div>

          <div className="self-start rounded-[24px] bg-white/92 px-4 py-3 text-right shadow-sm">
            {travelMode === 'taxi' && activeTaxiRecommendation ? (
              <>
                <div className="text-[10px] font-bold text-gray-400 mb-1">预计叫车</div>
                <div className="text-[15px] font-bold text-gray-900">
                  {activeTaxiRecommendation.estimatedWaitMinutes} 分钟
                </div>
                <div
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: activeModeMeta.softText }}
                >
                  {formatMoney(activeTaxiRecommendation.estimatedFare)}
                </div>
              </>
            ) : travelMode === 'transit' ? (
              <>
                <div className="text-[10px] font-bold text-gray-400 mb-1">公共交通</div>
                <div className="text-[15px] font-bold text-gray-900">
                  {routeMap?.totalDurationMin || 0} 分钟
                </div>
                <div
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: activeModeMeta.softText }}
                >
                  {routeMap?.segments?.reduce((sum, segment) => sum + (segment.transfers || 0), 0)}{' '}
                  次换乘
                </div>
              </>
            ) : travelMode === 'walking' ? (
              <>
                <div className="text-[10px] font-bold text-gray-400 mb-1">步行</div>
                <div className="text-[15px] font-bold text-gray-900">
                  {(Number(routeMap?.totalDistanceKm) * 1300).toFixed(0)} 步
                </div>
                <div
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: activeModeMeta.softText }}
                >
                  {routeMap?.totalDistanceKm} km
                </div>
              </>
            ) : travelMode === 'cycling' ? (
              <>
                <div className="text-[10px] font-bold text-gray-400 mb-1">骑行</div>
                <div className="text-[15px] font-bold text-gray-900">
                  {routeMap?.totalDurationMin || 0} 分钟
                </div>
                <div
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: activeModeMeta.softText }}
                >
                  {routeMap?.totalDistanceKm} km
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold text-gray-400 mb-1">当前方式</div>
                <div className="text-[15px] font-bold text-gray-900">{activeModeMeta.label}</div>
                <div
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: activeModeMeta.softText }}
                >
                  {routeMap?.totalCost ? formatMoney(routeMap.totalCost) : '费用更低'}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          {travelMode === 'taxi' && activeTaxiRecommendation && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                {activeTaxiRecommendation.tierLabel}
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                {activeTaxiRecommendation.passengerSummary}
              </span>
              {activeTaxiRecommendation.comfortTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-bold shadow-sm"
                  style={{ color: activeModeMeta.softText }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {travelMode === 'transit' && routeMap?.segments && routeMap.segments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                {routeMap.segments.reduce((sum, segment) => sum + (segment.transfers || 0), 0)}{' '}
                次换乘
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                步行{' '}
                {formatMeters(
                  routeMap.segments.reduce(
                    (sum, segment) => sum + (segment.walkingDistance || 0),
                    0
                  )
                )}
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                总用时 {routeMap.totalDurationMin} 分钟
              </span>
            </div>
          )}
          {travelMode === 'walking' && routeMap && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                约 {(Number(routeMap.totalDistanceKm) * 1300).toFixed(0)} 步
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                适合边走边逛
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                免费出行
              </span>
            </div>
          )}
          {travelMode === 'cycling' && routeMap && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                节奏更自由
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                适合近距离串点
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                低碳出行
              </span>
            </div>
          )}
          {travelMode === 'driving' && routeMap && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                最灵活方式
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                距离 {routeMap.totalDistanceKm} km
              </span>
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
                舒适自在
              </span>
            </div>
          )}
        </div>

        {hasTransitGuide && (
          <button
            onClick={() => setIsGuideExpanded(!isGuideExpanded)}
            className="mt-3 w-full rounded-[16px] bg-white/90 px-4 py-3 text-left shadow-sm border border-white/80"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100">
                  <span className="text-[10px] font-bold text-orange-600">!</span>
                </div>
                <div>
                  <div className="text-[13px] font-bold text-gray-900">查看详细换乘方案</div>
                  <div className="text-[10px] font-bold text-gray-500">
                    包含步行、乘车、换乘等完整指引
                  </div>
                </div>
              </div>
              {isGuideExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>
        )}
      </div>

      {hasTransitGuide && isGuideExpanded && routeGuide && (
        <RouteGuideCard
          routeGuide={routeGuide.segments}
          totalTime={routeGuide.totalTime}
          totalDistance={routeGuide.totalDistance}
          travelMode={travelMode}
          isExpanded={isGuideExpanded}
          onToggle={() => setIsGuideExpanded(!isGuideExpanded)}
        />
      )}
    </div>
  );
}
