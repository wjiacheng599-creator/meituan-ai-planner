import { planMultiPointRoute } from './apiAdapter';
import type { Activity } from './ai';
import type { TravelMode } from '../types';

export interface TimeAllocationResult {
  activities: Activity[];
  totalMinutes: number;
  travelMinutes: number;
  activityMinutes: number;
  segments: RouteSegment[];
}

export interface RouteSegment {
  from: string;
  to: string;
  duration: number;
  distance: number;
}

interface ParsedTime {
  hour: number;
  minute: number;
  totalMinutes: number;
}

function parseTimeLine(timeLine: string): { start: ParsedTime; end: ParsedTime } | null {
  const match = timeLine.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const startHour = parseInt(match[1]);
  const startMinute = parseInt(match[2]);
  const endHour = parseInt(match[3]);
  const endMinute = parseInt(match[4]);

  return {
    start: { hour: startHour, minute: startMinute, totalMinutes: startHour * 60 + startMinute },
    end: { hour: endHour, minute: endMinute, totalMinutes: endHour * 60 + endMinute },
  };
}

function formatTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function estimateActivityDuration(type: string): number {
  const durations: Record<string, number> = {
    food: 90,
    activity: 120,
    travel: 30,
    shopping: 60,
    lodging: 720,
    entertainment: 90,
  };
  return durations[type] || 90;
}

function buildRouteSegments(
  activities: Activity[],
  routeResult: { segments: Array<{ distance: number; duration: number }> }
): RouteSegment[] {
  const segments: RouteSegment[] = [];

  for (let i = 0; i < activities.length - 1; i++) {
    const routeSegment = routeResult.segments[i];
    segments.push({
      from: activities[i].title,
      to: activities[i + 1].title,
      duration: routeSegment?.duration || 30,
      distance: routeSegment?.distance || 0,
    });
  }

  return segments;
}

export async function allocateTimeWithRealMap(
  activities: Activity[],
  options?: {
    homeLocation?: { lat: number; lng: number };
    startHour?: number;
    travelMode?: TravelMode;
    city?: string;
  }
): Promise<TimeAllocationResult> {
  const { homeLocation, startHour = 9, travelMode = 'driving', city = '北京' } = options || {};

  if (activities.length === 0) {
    return {
      activities: [],
      totalMinutes: 0,
      travelMinutes: 0,
      activityMinutes: 0,
      segments: [],
    };
  }

  const activitiesWithCoords = activities.filter((a) => a.lat != null && a.lng != null);

  if (activitiesWithCoords.length < 2) {
    return allocateTimeWithoutRoute(activities, startHour);
  }

  const coords = activitiesWithCoords.map((a) => ({
    lng: a.lng!,
    lat: a.lat!,
  }));

  let routeResult: {
    totalDistance: number;
    totalDuration: number;
    segments: Array<{ distance: number; duration: number }>;
  };

  try {
    routeResult = await planMultiPointRoute(coords, travelMode, city);
  } catch (error) {
    console.warn('[TimeAllocator] Route planning failed, using fallback:', error);
    return allocateTimeWithoutRoute(activities, startHour);
  }

  const routeSegments = buildRouteSegments(activitiesWithCoords, routeResult);

  let currentTime = startHour * 60;
  const allocatedActivities: Activity[] = [];

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];

    if (i > 0) {
      const segment = routeSegments[i - 1];
      if (segment) {
        currentTime += Math.ceil(segment.duration);
      }
    }

    const duration = estimateActivityDuration(activity.type);
    const endTime = currentTime + duration;

    allocatedActivities.push({
      ...activity,
      timeLine: `${formatTime(currentTime)}-${formatTime(endTime)}`,
    });

    currentTime = endTime;
  }

  const totalActivityMinutes = allocatedActivities.reduce((sum, activity) => {
    const parsed = parseTimeLine(activity.timeLine);
    return sum + (parsed ? parsed.end.totalMinutes - parsed.start.totalMinutes : 0);
  }, 0);

  return {
    activities: allocatedActivities,
    totalMinutes: currentTime - startHour * 60,
    travelMinutes: routeResult.totalDuration,
    activityMinutes: totalActivityMinutes,
    segments: routeSegments,
  };
}

function allocateTimeWithoutRoute(
  activities: Activity[],
  startHour: number = 9
): TimeAllocationResult {
  let currentTime = startHour * 60;
  const allocatedActivities: Activity[] = [];

  for (const activity of activities) {
    const duration = estimateActivityDuration(activity.type);
    const endTime = currentTime + duration;

    allocatedActivities.push({
      ...activity,
      timeLine: `${formatTime(currentTime)}-${formatTime(endTime)}`,
    });

    currentTime = endTime + 30;
  }

  return {
    activities: allocatedActivities,
    totalMinutes: currentTime - startHour * 60,
    travelMinutes: 0,
    activityMinutes: currentTime - startHour * 60,
    segments: [],
  };
}

export function getActivityDuration(activity: Activity): number {
  const parsed = parseTimeLine(activity.timeLine);
  if (parsed) {
    return parsed.end.totalMinutes - parsed.start.totalMinutes;
  }
  return estimateActivityDuration(activity.type);
}

export function calculateTimeBuffer(
  activities: Activity[],
  actualStartHour: number = 9
): { buffer: number; overrun: boolean; details: string[] } {
  const details: string[] = [];
  let buffer = 0;
  let overrun = false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const expectedMinutes = actualStartHour * 60;

  buffer = expectedMinutes - currentMinutes;

  if (buffer < 0) {
    overrun = true;
    details.push(
      `当前时间 ${formatTime(currentMinutes)} 已超过计划开始时间 ${formatTime(expectedMinutes)}`
    );
  }

  const lastActivity = activities[activities.length - 1];
  if (lastActivity) {
    const parsed = parseTimeLine(lastActivity.timeLine);
    if (parsed) {
      const endMinutes = parsed.end.totalMinutes;
      if (endMinutes > 22 * 60) {
        details.push(`最后活动结束时间 ${formatTime(endMinutes)} 较晚`);
      }
    }
  }

  return { buffer, overrun, details };
}
