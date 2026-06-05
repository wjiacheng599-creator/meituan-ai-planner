import React from 'react';
import type { Plan } from '../../services/ai';
import type { TravelMode, RouteSegment, TaxiDispatchRecommendation } from '../../types';
import { MapPin, Clock3, WalletCards, ChevronRight, AlertCircle, Route } from 'lucide-react';
import { dataSource } from '../../services/apiAdapter';
import { TRAVEL_MODE_META } from '../../config/travelModes';
import { TravelModeSelector } from '../ui/TravelModeSelector';
import type { TransportRouteMapData } from './TransportInfoCard';

function formatMeters(distance: number): string {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

function formatMoney(value?: number): string {
  if (!value || value <= 0) return '约 ¥0';
  return `约 ¥${Math.round(value)}`;
}

function getModeSpecificDetail(mode: TravelMode, segment: RouteSegment): string {
  if (mode === 'taxi' && segment.taxi) {
    return `${segment.taxi.tierLabel} · ${segment.taxi.estimatedWaitMinutes} 分钟上车 · ${formatMoney(segment.taxi.estimatedFare)}`;
  }
  if (mode === 'transit') {
    const lineSummary = segment.transitDetails?.map((detail) => detail.lineName).join(' → ');
    if (lineSummary) {
      return `${lineSummary}${segment.transfers ? ` · ${segment.transfers} 次换乘` : ''}`;
    }
    return `${segment.transfers ? `${segment.transfers} 次换乘 · ` : ''}${segment.walkingDistance ? `步行 ${formatMeters(segment.walkingDistance)}` : formatMeters(segment.distance)}`;
  }
  if (mode === 'walking') {
    return `${formatMeters(segment.distance)} · 适合 citywalk`;
  }
  if (mode === 'cycling') {
    return `${formatMeters(segment.distance)} · 骑行节奏自由`;
  }
  return `${formatMeters(segment.distance)} · 连续跑点更顺`;
}

interface TravelModeInsight {
  primary: string;
  secondary: string;
  badge?: string;
  score?: string;
}

interface RoutePointCard {
  activityId: string;
  title: string;
  location: { lng: number; lat: number };
  segmentToNext?: RouteSegment;
}

export interface RouteOverviewCardProps {
  plan: Plan;
  travelMode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  readiness: Plan['executionReadiness'];
  readinessBadgeText: string;
  isRouteLoading: boolean;
  routeMap: TransportRouteMapData | null;
  travelModeInsights: Partial<Record<TravelMode, TravelModeInsight>>;
  routeHeadline: { title: string; detail: string };
  activeTaxiRecommendation: TaxiDispatchRecommendation | null;
  routePointCards: RoutePointCard[];
  routeError: string | null;
}

export default function RouteOverviewCard({
  plan,
  travelMode,
  onModeChange,
  readiness,
  readinessBadgeText,
  isRouteLoading,
  routeMap,
  travelModeInsights,
  routeHeadline,
  activeTaxiRecommendation,
  routePointCards,
  routeError,
}: RouteOverviewCardProps) {
  const modeMeta = TRAVEL_MODE_META[travelMode];
  const ModeIcon = modeMeta.icon;
  const currentInsight = travelModeInsights[travelMode];
  const highlightSegments = routeMap?.segments?.slice(0, 3) || [];

  return (
    <div className="app-card mb-5 overflow-hidden rounded-[24px] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-gray-900">路线总览</div>
          <div className="mt-1 text-[11px] font-bold text-gray-400">
            {isRouteLoading
              ? '正在计算真实路线'
              : dataSource.hasAmap
                ? '高德地图 · 实时路线能力'
                : '本地整理 · 路线概览'}
          </div>
        </div>
        <div
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
            readiness?.status === 'ready'
              ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
              : readiness?.status === 'adjust'
                ? 'bg-[var(--brand-soft)] text-[var(--brand-ink)]'
                : 'bg-[var(--danger-soft)] text-[var(--danger-ink)]'
          }`}
        >
          {readinessBadgeText}
        </div>
      </div>

      <div className="mt-4 -mx-1">
        <TravelModeSelector
          activeMode={travelMode}
          onSelectMode={onModeChange}
          loadingStates={isRouteLoading ? { [travelMode]: true } : {}}
        />
      </div>

      <div
        className="mt-4 overflow-hidden rounded-[24px] border"
        style={{ backgroundColor: modeMeta.bg, borderColor: modeMeta.border }}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-sm"
                style={{ color: modeMeta.softText }}
              >
                <ModeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-gray-900">{routeHeadline.title}</div>
                <div
                  className="mt-0.5 text-[11px] font-bold leading-relaxed"
                  style={{ color: modeMeta.softText }}
                >
                  {travelMode === 'transit'
                    ? '高德公交/地铁换乘规划 · 含线路与换乘信息'
                    : modeMeta.description}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[13px] font-bold text-gray-900">{routeHeadline.detail}</div>
            {currentInsight?.score && (
              <div className="mt-1 text-[11px] font-bold text-gray-500">{currentInsight.score}</div>
            )}
          </div>

          <div className="rounded-2xl bg-white/92 px-3.5 py-3 text-right shadow-sm">
            <div className="text-[10px] font-bold text-gray-400">当前方案</div>
            <div className="mt-1 text-[15px] font-bold text-gray-900">{modeMeta.label}</div>
            <div className="mt-1 text-[11px] font-bold" style={{ color: modeMeta.softText }}>
              {currentInsight?.badge || '已选中'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          <div className="rounded-2xl bg-white/82 px-3 py-3 shadow-[0_6px_18px_rgba(20,24,33,0.05)]">
            <div className="flex items-center gap-1.5 text-gray-400">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">地点</span>
            </div>
            <div className="mt-1 text-[15px] font-bold text-gray-900">
              {plan.activities.length} 个
            </div>
          </div>
          <div className="rounded-2xl bg-white/82 px-3 py-3 shadow-[0_6px_18px_rgba(20,24,33,0.05)]">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock3 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">时长</span>
            </div>
            <div className="mt-1 text-[15px] font-bold text-gray-900">
              {routeMap ? `${routeMap.totalDurationMin} 分钟` : plan.durationTags || '约5小时'}
            </div>
          </div>
          <div className="rounded-2xl bg-white/82 px-3 py-3 shadow-[0_6px_18px_rgba(20,24,33,0.05)]">
            <div className="flex items-center gap-1.5 text-gray-400">
              <WalletCards className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">
                {travelMode === 'taxi' ? '费用' : '路程'}
              </span>
            </div>
            <div className="mt-1 text-[15px] font-bold text-gray-900">
              {isRouteLoading
                ? '计算中'
                : routeMap
                  ? travelMode === 'taxi'
                    ? formatMoney(routeMap.totalCost)
                    : `${routeMap.totalDistanceKm} km`
                  : '已就绪'}
            </div>
          </div>
        </div>
      </div>

      {highlightSegments.length > 0 && (
        <div className="mt-4 rounded-[24px] border border-[var(--app-border)] bg-white px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-card-soft)]">
              <Route className="h-4 w-4 text-gray-700" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-gray-900">高德路线亮点</div>
              <div className="text-[10px] font-bold text-gray-500">
                按照当前交通方式拆解每一段出行
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {highlightSegments.map((segment, index) => (
              <span
                key={`${segment.mode}-${index}`}
                className="rounded-full bg-[var(--app-card-soft)] px-2.5 py-1.5 text-[10px] font-bold text-gray-600 border border-[var(--app-border)]"
              >
                第 {index + 1} 段 · {segment.duration} 分钟 ·{' '}
                {getModeSpecificDetail(travelMode, segment)}
              </span>
            ))}
          </div>
        </div>
      )}

      {routePointCards.length > 0 && (
        <div className="mt-4 space-y-3">
          {routePointCards.map((point, index) => (
            <div
              key={point.activityId}
              className="rounded-2xl border border-[var(--app-border)] bg-white px-4 py-4 shadow-[0_10px_20px_rgba(20,24,33,0.05)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-[11px] font-bold text-white shadow-sm">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-gray-900">{point.title}</div>
                  <div className="mt-1.5 text-[11px] font-bold text-gray-500 leading-relaxed">
                    {index < routePointCards.length - 1 && point.segmentToNext
                      ? `到下一站约 ${point.segmentToNext.duration} 分钟 · ${getModeSpecificDetail(travelMode, point.segmentToNext)}`
                      : '本段为路线末站'}
                  </div>

                  {point.segmentToNext && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--app-card-soft)] px-2.5 py-1 text-[10px] font-bold text-gray-600">
                        {point.segmentToNext.duration} 分钟
                      </span>
                      <span className="rounded-full bg-[var(--app-card-soft)] px-2.5 py-1 text-[10px] font-bold text-gray-600">
                        {formatMeters(point.segmentToNext.distance)}
                      </span>
                      {travelMode === 'transit' && point.segmentToNext.transfers != null && (
                        <span className="rounded-full bg-[var(--app-card-soft)] px-2.5 py-1 text-[10px] font-bold text-gray-600">
                          {point.segmentToNext.transfers} 次换乘
                        </span>
                      )}
                    </div>
                  )}

                  {point.segmentToNext?.transitDetails &&
                    point.segmentToNext.transitDetails.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {point.segmentToNext.transitDetails.map((detail) => (
                          <span
                            key={`${point.activityId}-${detail.lineName}`}
                            className="rounded-full bg-orange-50 px-2.5 py-1.5 text-[10px] font-bold text-orange-600"
                          >
                            {detail.lineName} · {detail.stationCount} 站
                          </span>
                        ))}
                      </div>
                    )}

                  {point.segmentToNext?.steps && point.segmentToNext.steps.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {point.segmentToNext.steps.slice(0, 3).map((step) => (
                        <span
                          key={step}
                          className="rounded-full bg-[var(--app-card-soft)] px-2.5 py-1.5 text-[10px] font-bold text-gray-600"
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {index < routePointCards.length - 1 && (
                  <div className="mt-1">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTaxiRecommendation && travelMode === 'taxi' && (
        <div className="mt-4 rounded-[24px] border border-[var(--app-border)] bg-white px-4 py-4">
          <div className="text-[13px] font-bold text-gray-900">叫车建议</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--app-card-soft)] px-3 py-1.5 text-[11px] font-bold text-gray-700">
              {activeTaxiRecommendation.tierLabel}
            </span>
            <span className="rounded-full bg-[var(--app-card-soft)] px-3 py-1.5 text-[11px] font-bold text-gray-700">
              {activeTaxiRecommendation.passengerSummary}
            </span>
            {activeTaxiRecommendation.comfortTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--app-card-soft)] px-3 py-1.5 text-[11px] font-bold text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {routeError && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--danger-soft)] border border-[#ffd6dd] px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-[var(--danger-ink)] mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-bold text-[var(--danger-ink)]">路线计算失败</div>
            <div className="mt-0.5 text-[11px] font-bold text-gray-500">{routeError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
