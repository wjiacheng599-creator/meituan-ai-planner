import React from 'react';
import { ChevronDown, ChevronUp, Footprints, Car, Train, Bike } from 'lucide-react';
import type { RouteSegmentResult, TransitSegmentDetail } from '../../services/routePlanning';
import type { TravelMode } from '../../types';
import { TRAVEL_MODE_META } from '../../config/travelModes';

interface RouteGuideCardProps {
  routeGuide: RouteSegmentResult[];
  totalTime: number;
  totalDistance: number;
  travelMode: TravelMode;
  onToggle?: () => void;
  isExpanded?: boolean;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 米`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

function getModeIcon(mode: TravelMode) {
  const icons = {
    driving: Car,
    taxi: Car,
    transit: Train,
    walking: Footprints,
    cycling: Bike,
  };
  return icons[mode] || Car;
}

function getModeName(mode: TravelMode): string {
  const names = {
    driving: '驾车',
    taxi: '打车',
    transit: '公交/地铁',
    walking: '步行',
    cycling: '骑行',
  };
  return names[mode] || '未知';
}

function TransitSegmentDetailView({ detail }: { detail: TransitSegmentDetail }) {
  const isSubway = detail.lineType === '地铁' || detail.lineName.includes('号线');
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1.5">
      <span
        className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
          isSubway ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
        }`}
      >
        {isSubway ? '地铁' : '公交'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-900 truncate">{detail.lineName}</span>
          <span className="shrink-0 text-[10px] font-bold text-gray-400">
            {detail.stationCount}站
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="truncate">{detail.startStation}</span>
          <span className="shrink-0 text-gray-300">→</span>
          <span className="truncate">{detail.endStation}</span>
        </div>
      </div>
    </div>
  );
}

function SegmentItem({
  segment,
  index,
  totalSegments,
}: {
  segment: RouteSegmentResult;
  index: number;
  totalSegments: number;
}) {
  const ModeIcon = getModeIcon(segment.mode);
  const modeMeta = TRAVEL_MODE_META[segment.mode];

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
          style={{ backgroundColor: modeMeta.bg, color: modeMeta.softText }}
        >
          <ModeIcon className="w-4 h-4" />
        </div>
        {index < totalSegments - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
      </div>

      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-gray-500">{getModeName(segment.mode)}</span>
          <span className="text-[10px] font-bold text-gray-400">
            {formatDistance(segment.distance)} · {segment.time}分钟
          </span>
        </div>

        <div className="text-[13px] font-bold text-gray-800 leading-relaxed">
          {segment.instruction}
        </div>

        {segment.transitDetails &&
          segment.transitDetails.map((detail, dIndex) => (
            <TransitSegmentDetailView key={dIndex} detail={detail} />
          ))}

        {segment.mode === 'walking' && !!segment.path?.length && (
          <div className="mt-1 text-[10px] text-gray-500 flex items-center gap-1">
            <Footprints className="w-3 h-3" />
            <span>步行导航中，请注意安全</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RouteGuideCard({
  routeGuide,
  totalTime,
  totalDistance,
  travelMode,
  onToggle,
  isExpanded = true,
}: RouteGuideCardProps) {
  const modeMeta = TRAVEL_MODE_META[travelMode];
  const ModeIcon = getModeIcon(travelMode);

  const hasTransitDetails = routeGuide.some((s) => s.transitDetails && s.transitDetails.length > 0);
  const transferCount =
    routeGuide.filter((s) => s.transitDetails && s.transitDetails.length > 0).length - 1;

  return (
    <div
      className="mt-3 rounded-[24px] border overflow-hidden"
      style={{ backgroundColor: modeMeta.bg, borderColor: modeMeta.border }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm"
            style={{ backgroundColor: '#ffffffcc', color: modeMeta.softText }}
          >
            <ModeIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-gray-900">路线规划详情</div>
            <div className="mt-0.5 text-[11px] font-bold" style={{ color: modeMeta.softText }}>
              {hasTransitDetails && `${transferCount} 次换乘 · `}
              {formatDistance(totalDistance)} · 约 {totalTime} 分钟
            </div>
          </div>
        </div>

        {onToggle && (
          <button className="p-1 rounded-full hover:bg-white/50 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="bg-white/80 rounded-[16px] p-3">
            {routeGuide.map((segment, index) => (
              <SegmentItem
                key={index}
                segment={segment}
                index={index}
                totalSegments={routeGuide.length}
              />
            ))}
          </div>

          {hasTransitDetails && (
            <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>公交地铁</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span>公交</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span>步行</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
