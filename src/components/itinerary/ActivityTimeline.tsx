import React, { useState, useCallback } from 'react';
import { Check, MapPin } from 'lucide-react';
import { seededRating } from '../../services/utils';
import ActivityCard from './ActivityCard';
import HomeCard from './HomeCard';
import TravelSegmentCard from './TravelSegmentCard';
import type { ActivityTimelineProps } from './types';

function ActivityTimelineInner({
  activities,
  uiVariant,
  selectedIds,
  bookedIds,
  emphasizedIds,
  actualDurations,
  onActivityClick,
  onToggleSelect,
  onUpdatePlan,
  homeLocation,
  routeSegments,
  travelMode,
  onBookTaxi,
}: ActivityTimelineProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => setDragIndex(idx), []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
  }, []);

  const handleDrop = useCallback(
    (idx: number) => {
      if (dragIndex === null || dragIndex === idx || !onUpdatePlan) return;
      const newActivities = [...activities];
      const [removed] = newActivities.splice(dragIndex, 1);
      newActivities.splice(idx, 0, removed);
      onUpdatePlan(newActivities);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, activities, onUpdatePlan]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const getSegmentForActivity = useCallback(
    (activityIndex: number) => {
      if (!routeSegments || routeSegments.length === 0 || !travelMode) {
        return null;
      }

      const segmentIndex = homeLocation ? activityIndex : activityIndex - 1;
      if (segmentIndex < 0 || segmentIndex >= routeSegments.length) {
        return null;
      }

      return routeSegments[segmentIndex] || null;
    },
    [routeSegments, travelMode, homeLocation]
  );

  const getLastSegmentToHome = useCallback(() => {
    if (!routeSegments || routeSegments.length === 0 || !travelMode || !homeLocation) {
      return null;
    }
    return routeSegments[routeSegments.length - 1] || null;
  }, [routeSegments, travelMode, homeLocation]);

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-10 bottom-4 w-[2px] bg-gradient-to-b from-[var(--sky-ink)] via-[var(--sky-strong)] to-[var(--mint-ink)] z-0 opacity-50"></div>

      {homeLocation && (
        <HomeCard
          title="起点"
          index={-1}
          location={homeLocation}
          travelTime={actualDurations.get(0)}
        />
      )}

      {activities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-14 h-14 bg-[var(--app-card-soft)] rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-6 h-6 text-[var(--app-text-soft)]" />
          </div>
          <div className="text-[13px] font-bold text-[var(--app-ink)]">行程中暂无活动</div>
          <div className="mt-1.5 text-[13px] font-medium text-[var(--app-text-soft)]">
            让管家帮你规划一天的行程吧
          </div>
        </div>
      )}

      {activities
        .filter((a) => a.type !== 'travel')
        .map((activity, index) => {
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;
          const isSelected = selectedIds.has(activity.id);
          const isBooked = bookedIds.has(activity.id);
          const isEmphasized = emphasizedIds.includes(activity.id);
          void seededRating(activity.id || `act-${index}`);

          const displayIndex = index + 1;
          const segment = getSegmentForActivity(index);

          return (
            <div
              key={activity.id || `act-${index}`}
              className={`relative z-10 transition-all duration-200 mb-4 ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
            >
              {isDragOver && (
                <div className="mx-10 mb-2.5 h-1.5 animate-pulse rounded-full bg-[var(--peach-ink)]"></div>
              )}

              {segment && (
                <div className="mb-2">
                  <TravelSegmentCard
                    segment={segment}
                    travelMode={travelMode || 'driving'}
                    isCompact={true}
                    onBookTaxi={onBookTaxi}
                  />
                </div>
              )}

              <ActivityCard
                activity={activity}
                index={displayIndex}
                variant={uiVariant}
                isSelected={isSelected}
                isBooked={isBooked}
                isEmphasized={isEmphasized}
                travelTime={
                  homeLocation
                    ? (actualDurations.get(index + 1) ?? undefined)
                    : index > 0
                      ? (actualDurations.get(index) ?? 0)
                      : undefined
                }
                onActivityClick={onActivityClick}
                onToggleSelect={onToggleSelect}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                draggable={!!onUpdatePlan}
              />
            </div>
          );
        })}

      {activities.length > 0 && homeLocation && (
        <>
          {(() => {
            const lastSegment = getLastSegmentToHome();
            if (lastSegment) {
              return (
                <div className="mb-2">
                  <TravelSegmentCard
                    segment={lastSegment}
                    travelMode={travelMode || 'driving'}
                    isCompact={true}
                  />
                </div>
              );
            }
            return null;
          })()}
          <HomeCard title="终点" index={activities.length} location={homeLocation} />
        </>
      )}
    </div>
  );
}

export default React.memo(ActivityTimelineInner);
