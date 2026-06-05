import React, { useState, useMemo } from 'react';
import { MapPin, Clock, WalletCards, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { Plan } from '../../services/ai';
import type { TravelMode, RouteSegment } from '../../types';
import { TRAVEL_MODE_META } from '../../config/travelModes';
import { TravelModeSelector } from '../ui/TravelModeSelector';
import type { RoutePlanningResult } from '../../services/routePlanning';
import { formatDuration, formatDistance } from '../../utils/routeComparison';

interface UnifiedRouteOverviewProps {
  plan: Plan;
  activeMode: TravelMode;
  onSelectMode: (mode: TravelMode) => void;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  currentRoute: RoutePlanningResult | null;
  routePointCards: Array<{
    activityId: string;
    title: string;
    location: { lng: number; lat: number };
    segmentToNext?: RouteSegment;
  }>;
  routeError: string | null;
}

export function UnifiedRouteOverview({
  plan,
  activeMode,
  onSelectMode,
  loading,
  errors,
  currentRoute,
  routePointCards,
  routeError,
}: UnifiedRouteOverviewProps) {
  const [showSegments, setShowSegments] = useState(false);
  const modeMeta = TRAVEL_MODE_META[activeMode];
  const Icon = modeMeta.icon;

  const estimatedCost = useMemo(() => {
    if (!currentRoute) return null;

    if (activeMode === 'taxi') {
      const distanceKm = currentRoute.totalDistance / 1000;
      return Math.round(13 + distanceKm * 2.5);
    }

    if (activeMode === 'transit') {
      const distanceKm = currentRoute.totalDistance / 1000;
      return Math.max(2, Math.ceil(distanceKm / 5) * 2);
    }

    return null;
  }, [currentRoute, activeMode]);

  return (
    <div className="app-card mb-5 overflow-hidden rounded-[24px] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-gray-900">路线概览</div>
          <div className="mt-1 text-[11px] font-bold text-gray-400">
            {Object.values(loading).some((v) => v)
              ? '正在计算多种出行方案...'
              : '选择最适合您的出行方式'}
          </div>
        </div>
      </div>

      <div className="mt-4 -mx-1">
        <TravelModeSelector
          activeMode={activeMode}
          onSelectMode={onSelectMode}
          loadingStates={loading}
        />
      </div>

      <div
        className="mt-4 rounded-[24px] border p-4"
        style={{
          backgroundColor: modeMeta.bg,
          borderColor: modeMeta.border,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: '#ffffffcc', color: modeMeta.softText }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-gray-900">{modeMeta.label}出行</div>
              <div
                className="mt-1 text-[11px] font-bold leading-relaxed"
                style={{ color: modeMeta.softText }}
              >
                {modeMeta.description}
              </div>
            </div>
          </div>

          <div className="self-start rounded-[24px] bg-white/92 px-4 py-3 text-right shadow-sm">
            {loading[activeMode] ? (
              <div>
                <div className="text-[10px] font-bold text-gray-400 mb-1">计算中</div>
                <div className="text-[15px] font-bold text-gray-400">...</div>
              </div>
            ) : currentRoute ? (
              <div>
                <div className="text-[10px] font-bold text-gray-400 mb-1">预计时间</div>
                <div className="text-[15px] font-bold text-gray-900">
                  {formatDuration(currentRoute.totalTime)}
                </div>
                {estimatedCost !== null && (
                  <div
                    className="mt-0.5 text-[11px] font-bold"
                    style={{ color: modeMeta.softText }}
                  >
                    约 ¥{estimatedCost}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-[10px] font-bold text-gray-400 mb-1">暂无数据</div>
                <div className="text-[15px] font-bold text-gray-400">-</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="app-card-soft rounded-2xl px-3 py-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">地点</span>
          </div>
          <div className="mt-1 text-[13px] font-bold text-gray-900">
            {plan.activities.length} 个
          </div>
        </div>

        <div className="app-card-soft rounded-2xl px-3 py-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">距离</span>
          </div>
          <div className="mt-1 text-[13px] font-bold text-gray-900">
            {currentRoute ? formatDistance(currentRoute.totalDistance) : '-'}
          </div>
        </div>

        <div className="app-card-soft rounded-2xl px-3 py-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <WalletCards className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">{activeMode === 'taxi' ? '费用' : '时间'}</span>
          </div>
          <div className="mt-1 text-[13px] font-bold text-gray-900">
            {loading[activeMode]
              ? '计算中'
              : estimatedCost !== null
                ? `¥${estimatedCost}`
                : currentRoute
                  ? formatDuration(currentRoute.totalTime)
                  : '-'}
          </div>
        </div>
      </div>

      {routePointCards.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowSegments(!showSegments)}
            className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-left"
          >
            <span className="text-[13px] font-bold text-gray-700">
              查看详细路线段 ({routePointCards.length} 段)
            </span>
            {showSegments ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showSegments && (
            <div className="mt-3 space-y-2">
              {routePointCards.map((point, index) => (
                <div
                  key={point.activityId}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-gray-900 truncate">
                        {point.title}
                      </div>
                      {index < routePointCards.length - 1 && point.segmentToNext && (
                        <div className="mt-1 text-[10px] font-semibold text-gray-500">
                          到下一站: {formatDuration(point.segmentToNext.duration)} ·{' '}
                          {formatDistance(point.segmentToNext.distance)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {routeError && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-100 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-bold text-red-700">路线计算提示</div>
            <div className="mt-0.5 text-[11px] font-semibold text-red-600">{routeError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
