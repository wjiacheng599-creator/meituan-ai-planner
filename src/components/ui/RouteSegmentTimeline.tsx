import React from 'react';
import { Car, Train, Bike, Footprints, ArrowRight } from 'lucide-react';
import type { TravelMode, RouteSegment } from '../../types';

const MODE_ICONS = {
  driving: Car,
  transit: Train,
  cycling: Bike,
  walking: Footprints,
};

const MODE_COLORS = {
  driving: '#3b82f6',
  transit: '#f97316',
  cycling: '#22c55e',
  walking: '#6b7280',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}分钟`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}小时${remainingMins}分钟` : `${hours}小时`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}

export interface RouteSegmentTimelineProps {
  segments: RouteSegment[];
  onSegmentClick?: (segment: RouteSegment) => void;
  className?: string;
}

export function RouteSegmentTimeline({
  segments,
  onSegmentClick,
  className = '',
}: RouteSegmentTimelineProps) {
  if (segments.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((segment, index) => {
        const Icon = MODE_ICONS[segment.mode];
        const color = MODE_COLORS[segment.mode];

        return (
          <div key={index} className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-[12px] px-3 py-2 cursor-pointer transition-opacity hover:opacity-80"
              style={{ backgroundColor: `${color}15` }}
              onClick={() => onSegmentClick?.(segment)}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-[13px] font-bold" style={{ color }}>
                {formatDuration(segment.duration)}
              </span>
              <span className="text-[11px] text-gray-400 font-bold">
                {formatDistance(segment.distance)}
              </span>
            </div>
            {index < segments.length - 1 && (
              <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
