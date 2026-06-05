import type { Activity } from './ai';

export interface LodgingDecision {
  needLodging: boolean;
  reason: string;
  checkInTime?: string;
  checkOutTime?: string;
  confidence: number;
}

export interface UserPreference {
  alwaysStay?: boolean;
  preferReturn?: boolean;
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

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function decideLodgingNeed(
  activities: Activity[],
  homeLocation?: { lat: number; lng: number },
  userPreference?: UserPreference,
  explicitLodgingKeywords?: boolean
): LodgingDecision {
  if (activities.length === 0) {
    return { needLodging: false, reason: '无活动安排', confidence: 1.0 };
  }

  if (userPreference?.preferReturn) {
    return { needLodging: false, reason: '用户明确要求当天往返', confidence: 1.0 };
  }

  if (userPreference?.alwaysStay || explicitLodgingKeywords) {
    const lastActivity = activities[activities.length - 1];
    const lastTime = parseTimeLine(lastActivity?.timeLine || '');

    return {
      needLodging: true,
      reason: '用户明确要求住宿',
      checkInTime: lastTime
        ? `${lastTime.end.hour}:${String(lastTime.end.minute).padStart(2, '0')}`
        : '22:00',
      checkOutTime: '次日12:00',
      confidence: 1.0,
    };
  }

  const firstActivity = activities[0];
  const lastActivity = activities[activities.length - 1];

  const firstTime = parseTimeLine(firstActivity?.timeLine || '');
  const lastTime = parseTimeLine(lastActivity?.timeLine || '');

  if (!firstTime || !lastTime) {
    return { needLodging: false, reason: '无法解析活动时间', confidence: 0.5 };
  }

  const timeSpanHours = (lastTime.end.totalMinutes - firstTime.start.totalMinutes) / 60;

  if (timeSpanHours > 12 && lastTime.end.hour >= 22) {
    return {
      needLodging: true,
      reason: `活动时间跨度过长（${timeSpanHours.toFixed(1)}小时），且最后活动结束时间晚于22:00`,
      checkInTime: `${lastTime.end.hour}:${String(lastTime.end.minute).padStart(2, '0')}`,
      checkOutTime: '次日12:00',
      confidence: 0.85,
    };
  }

  if (timeSpanHours > 14) {
    return {
      needLodging: true,
      reason: `活动时间跨度较长（${timeSpanHours.toFixed(1)}小时），建议住宿休息`,
      checkInTime: `${lastTime.end.hour}:${String(lastTime.end.minute).padStart(2, '0')}`,
      checkOutTime: '次日12:00',
      confidence: 0.75,
    };
  }

  if (lastActivity.lat != null && lastActivity.lng != null && homeLocation) {
    const distance = calculateDistance(
      homeLocation.lat,
      homeLocation.lng,
      lastActivity.lat,
      lastActivity.lng
    );

    if (distance > 100) {
      return {
        needLodging: true,
        reason: `最后活动地点距离家${distance.toFixed(1)}km，跨城出行建议住宿`,
        checkInTime: `${lastTime.end.hour}:${String(lastTime.end.minute).padStart(2, '0')}`,
        checkOutTime: '次日12:00',
        confidence: 0.9,
      };
    }
  }

  return {
    needLodging: false,
    reason: '活动时间合理，建议当天往返',
    confidence: 0.8,
  };
}

export function parseLodgingKeywords(query: string): boolean {
  const lodgingKeywords = [
    '住宿',
    '酒店',
    '住一晚',
    '住两天',
    '多天',
    '过夜',
    '订房',
    '酒店预订',
    '晚上住',
    '留宿',
    '住下',
  ];

  const returnKeywords = ['当天往返', '当天回', '回家', '不留宿', '不住宿', '不住'];

  for (const keyword of returnKeywords) {
    if (query.includes(keyword)) {
      return false;
    }
  }

  for (const keyword of lodgingKeywords) {
    if (query.includes(keyword)) {
      return true;
    }
  }

  return false;
}

export function generateLodgingCheckMessage(decision: LodgingDecision): string {
  if (decision.needLodging) {
    return `💡 建议安排住宿：${decision.reason}`;
  }
  return '';
}
