import React, { useMemo } from 'react';
import { TravelMode } from '../../types';
import { TRAVEL_MODE_META } from '../../config/travelModes';
import { Loader2, AlertCircle, Clock, Route } from 'lucide-react';
import type { RoutePlanningResult } from '../../services/routePlanning';
import { analyzeRoutes, formatDuration, formatDistance } from '../../utils/routeComparison';

interface MultiRouteSelectorProps {
  activeMode: TravelMode;
  routes: Record<string, RoutePlanningResult | undefined>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  onSelectMode: (mode: TravelMode) => void;
}

export function MultiRouteSelector({
  activeMode,
  routes,
  loading,
  errors,
  onSelectMode,
}: MultiRouteSelectorProps) {
  const comparisons = useMemo(() => {
    return analyzeRoutes(routes);
  }, [routes]);

  const comparisonMap = useMemo(() => {
    const map = new Map<TravelMode, any>();
    comparisons.forEach((c) => map.set(c.mode, c));
    return map;
  }, [comparisons]);

  const hasAnyRoute = Object.values(routes).some((route) => route !== undefined);
  const modes = Object.keys(TRAVEL_MODE_META) as TravelMode[];
  const currentRoute = routes[activeMode];

  const getShortTag = (tag: string) => {
    const tags = tag.split(' · ');
    return tags[0] || tag;
  };

  return (
    <div className="bg-[var(--app-card)] rounded-2xl border border-[var(--app-border)] px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-[var(--app-ink)] tracking-wide">出行方式</h3>
        {Object.values(loading).some((v) => v) && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-soft)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>规划中</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        {modes.map((modeKey) => {
          const mode = modeKey;
          const config = TRAVEL_MODE_META[mode];
          const Icon = config.icon;
          const isSelected = activeMode === mode;
          const isLoading = loading[mode];
          const error = errors[mode];
          const route = routes[mode];
          const comparison = comparisonMap.get(mode);
          const hasTag = comparison?.tag && route && !isLoading;
          const shortTag = hasTag ? getShortTag(comparison.tag) : '';
          const hasTime = route && !isLoading && !error;

          return (
            <button
              key={mode}
              onClick={() => onSelectMode(mode)}
              className={`
                relative flex-shrink-0 flex flex-col items-center justify-center
                rounded-xl transition-all duration-200 cursor-pointer
                min-w-[68px] px-2 py-2
                ${
                  isSelected
                    ? 'bg-[var(--app-card)] shadow-[var(--shadow-soft)] border-2'
                    : 'bg-gray-50 hover:bg-gray-100 border border-[var(--app-border)]'
                }
              `}
              style={{
                borderColor: isSelected ? config.color : undefined,
                minHeight: '72px',
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <Icon className="w-5 h-5" style={{ color: config.color }} />
                <span
                  className={`text-[11px] font-bold ${
                    isSelected ? 'text-[var(--app-ink)]' : 'text-[var(--app-text)]'
                  }`}
                >
                  {config.label}
                </span>
                {hasTime && (
                  <span className="text-[10px] text-[var(--app-text-soft)] font-medium leading-tight">
                    {formatDuration(route.totalTime)}
                  </span>
                )}

                {isLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--app-text-soft)]" />
                )}

                {error && !isLoading && (
                  <AlertCircle className="w-3.5 h-3.5 text-[var(--warning-ink)]" />
                )}

                {hasTag && (
                  <div
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight"
                    style={{
                      backgroundColor: isSelected ? config.color : `${config.color}15`,
                      color: isSelected ? 'white' : config.color,
                    }}
                    title={comparison.tag}
                  >
                    {shortTag}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {currentRoute && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--app-border)] text-[13px]">
          <span className="flex items-center gap-1.5 text-[var(--app-text)]">
            <Clock className="w-3.5 h-3.5 text-[var(--sky-ink)]" />
            <span className="font-bold">{formatDuration(currentRoute.totalTime)}</span>
          </span>
          <span className="text-[var(--app-border-strong)]">·</span>
          <span className="flex items-center gap-1.5 text-[var(--app-text)]">
            <Route className="w-3.5 h-3.5 text-[var(--sky-ink)]" />
            <span className="font-bold">{formatDistance(currentRoute.totalDistance)}</span>
          </span>
        </div>
      )}

      {!hasAnyRoute && !Object.values(loading).some((v) => v) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--app-border)] text-[11px] text-[var(--warning-ink)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>路线规划暂不可用，请稍后重试</span>
        </div>
      )}
    </div>
  );
}
