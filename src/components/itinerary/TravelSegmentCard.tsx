import React from 'react';
import { Footprints, Clock, MapPin, CarTaxiFront } from 'lucide-react';
import type { RouteSegment, TravelMode } from '../../types';
import { TRAVEL_MODE_META } from '../../config/travelModes';

interface TravelSegmentCardProps {
  segment: RouteSegment;
  travelMode: TravelMode;
  isCompact?: boolean;
  onBookTaxi?: (
    from: { name: string; lat: number; lng: number },
    to: { name: string; lat: number; lng: number }
  ) => void;
}

// 根据颜色值转换为 Tailwind 类名
const getColorClasses = (color: string, bg: string) => {
  // 根据 hex 颜色值映射到 Tailwind 类
  const colorMap: Record<string, { color: string; bgColor: string }> = {
    '#3b82f6': { color: 'text-blue-600', bgColor: 'bg-blue-50' },
    '#f59e0b': { color: 'text-amber-600', bgColor: 'bg-amber-50' },
    '#f97316': { color: 'text-orange-600', bgColor: 'bg-orange-50' },
    '#22c55e': { color: 'text-green-600', bgColor: 'bg-green-50' },
    '#6b7280': { color: 'text-gray-600', bgColor: 'bg-gray-50' },
  };
  return colorMap[color] || { color: 'text-gray-600', bgColor: 'bg-gray-50' };
};

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} 米`;
  }
  return `${(meters / 1000).toFixed(1)} 公里`;
}

function formatCost(yuan: number): string {
  return `¥${yuan.toFixed(0)}`;
}

export default function TravelSegmentCard({
  segment,
  travelMode,
  isCompact = false,
  onBookTaxi,
}: TravelSegmentCardProps) {
  const meta = TRAVEL_MODE_META[travelMode];
  const Icon = meta.icon;
  const { color: textColor, bgColor } = getColorClasses(meta.color, meta.bg);

  const renderTransitInfo = () => {
    if (travelMode !== 'transit' || !segment.transitDetails?.length) {
      return null;
    }

    return (
      <div className="mt-2.5 space-y-1.5">
        {segment.transitDetails.map((detail, index) => {
          const isSubway = detail.lineType === '地铁' || detail.lineName.includes('号线');
          return (
            <div
              key={index}
              className="flex items-center gap-2 rounded-xl bg-white/90 px-2.5 py-1.5 border border-white/80"
            >
              <span
                className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold ${
                  isSubway ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}
              >
                {isSubway ? '地铁' : '公交'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-900 truncate">
                    {detail.lineName}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-gray-400">
                    {detail.stationCount}站
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                  <span className="truncate">{detail.startStation}</span>
                  <span className="shrink-0 text-gray-300">→</span>
                  <span className="truncate">{detail.endStation}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInstructions = () => {
    if (!segment.steps?.length || isCompact) {
      return null;
    }

    return (
      <div className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
        {segment.steps.slice(0, 2).join(' → ')}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 my-2 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100/50 border border-gray-200/50 backdrop-blur-sm">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bgColor}`}>
        <Icon className={`w-4 h-4 ${textColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="w-3 h-3" />
            <span className="font-semibold">{formatDuration(segment.duration)}</span>
          </div>

          <div className="flex items-center gap-1 text-gray-500">
            <MapPin className="w-3 h-3" />
            <span className="font-mono">{formatDistance(segment.distance)}</span>
          </div>

          {segment.cost !== undefined && segment.cost > 0 && (
            <div className={`flex items-center gap-1 font-bold ${textColor}`}>
              <span>{formatCost(segment.cost)}</span>
            </div>
          )}

          {segment.walkingDistance !== undefined &&
            segment.walkingDistance > 0 &&
            travelMode === 'transit' && (
              <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                <Footprints className="w-3 h-3" />
                <span>步行{formatDistance(segment.walkingDistance)}</span>
              </div>
            )}

          {segment.transfers !== undefined && segment.transfers > 0 && (
            <div className="text-[10px] text-orange-600 font-bold">换乘{segment.transfers}次</div>
          )}
        </div>

        {renderTransitInfo()}
        {renderInstructions()}
      </div>

      {!isCompact && (
        <div
          className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold ${bgColor} ${textColor}`}
        >
          {meta.label}
        </div>
      )}

      {segment.from.lat !== undefined && segment.to.lat !== undefined && onBookTaxi && travelMode === 'taxi' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookTaxi(
              { name: segment.from.name, lat: segment.from.lat, lng: segment.from.lng },
              { name: segment.to.name, lat: segment.to.lat, lng: segment.to.lng }
            );
          }}
          className="shrink-0 flex h-8 items-center gap-1 rounded-full bg-[var(--brand-soft)] px-3 text-[11px] font-bold text-[var(--brand-ink)] active:scale-95 transition-transform"
        >
          <CarTaxiFront className="w-3.5 h-3.5" />
          去打车
        </button>
      )}
    </div>
  );
}
