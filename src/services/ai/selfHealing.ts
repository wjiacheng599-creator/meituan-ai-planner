/**
 * 自愈行程系统 - 行程执行中的自动适应
 *
 * 监控行程状态，在异常发生时自动调整：
 * 1. 天气变化 → 提醒 + 室内替代方案
 * 2. 时间超支 → 调整后续活动时间
 * 3. 活动取消 → 推荐替代方案
 * 4. 高峰时段 → 提示排队风险 + 优化建议
 *
 * 设计理念：
 * - 轻量级检测，不依赖外部监控服务
 * - 基于已有的天气/POI 数据
 * - 生成结构化的"调整建议"，UI 层决定如何展示
 */
import type { Plan, Activity, WeatherInfo } from './types';
import { fetchWeather, getUserCity } from './weather';
import { callDashScope, sanitizeUserInput } from './core';

// ── 类型定义 ──

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface TripAlert {
  id: string;
  type: 'weather' | 'time_overrun' | 'activity_cancel' | 'crowd' | 'budget' | 'custom';
  severity: AlertSeverity;
  title: string;
  message: string;
  affectedActivityId?: string;
  suggestedAction?: string;
  alternativeActivities?: Partial<Activity>[];
  timestamp: number;
}

export interface TripHealthStatus {
  overallHealth: 'healthy' | 'attention' | 'at_risk';
  alerts: TripAlert[];
  recommendations: string[];
  timeBuffer: number; // 分钟，正数=提前，负数=延迟
  budgetRemaining: number;
  weatherRisk: 'none' | 'low' | 'medium' | 'high';
}

export interface HealingSuggestion {
  type: 'reschedule' | 'replace' | 'skip' | 'add_break' | 'change_route';
  originalActivityId: string;
  reason: string;
  newActivity?: Partial<Activity>;
  newTimeSlot?: string;
  confidence: number; // 0-1
}

// ── 天气自愈 ──

export async function checkWeatherHealing(plan: Plan, weather?: WeatherInfo): Promise<TripAlert[]> {
  const alerts: TripAlert[] = [];

  let currentWeather = weather;
  if (!currentWeather) {
    try {
      const city = plan.city || (await getUserCity());
      currentWeather = await fetchWeather(city);
    } catch {
      return alerts;
    }
  }

  const hasBadWeather = /雨|雪|雷|雾|大风|冰雹/.test(currentWeather.condition);
  const indoorKeywords = /博物馆|美术馆|电影院|商场|购物|KTV|室内|书店|图书馆|展览|密室|桌游|温泉|SPA|按摩|网吧|游戏厅|游乐场|水族馆|海洋馆|科技馆|天文馆|蜡像馆/;
  const isOutdoor = (a: { type: string; title: string; tags?: string[] }) => {
    if (a.type !== 'activity') return false;
    const text = a.title + (a.tags || []).join('');
    return !indoorKeywords.test(text);
  };
  const hasOutdoorActivities = plan.activities.some(isOutdoor);

  if (hasBadWeather && hasOutdoorActivities) {
    const outdoorActivities = plan.activities.filter(isOutdoor);
    const severity: AlertSeverity = /雷|暴雨|大雪|冰雹/.test(currentWeather.condition)
      ? 'critical'
      : 'warning';

    alerts.push({
      id: `weather_${Date.now()}`,
      type: 'weather',
      severity,
      title: `天气预警：${currentWeather.condition}`,
      message: `${currentWeather.city}${currentWeather.condition}，${currentWeather.temp}°C。你的行程中有 ${outdoorActivities.length} 个户外活动可能受影响。`,
      affectedActivityId: outdoorActivities[0]?.id,
      suggestedAction: severity === 'critical' ? '建议调整为室内方案' : '建议准备雨具或调整顺序',
      timestamp: Date.now(),
    });
  }

  // 高温/低温预警
  if (currentWeather.temp > 35) {
    alerts.push({
      id: `heat_${Date.now()}`,
      type: 'weather',
      severity: 'warning',
      title: '高温预警',
      message: `当前 ${currentWeather.temp}°C，户外活动注意防暑。建议避开 11:00-15:00 高温时段。`,
      suggestedAction: '调整时间或增加室内休息',
      timestamp: Date.now(),
    });
  } else if (currentWeather.temp < 0) {
    alerts.push({
      id: `cold_${Date.now()}`,
      type: 'weather',
      severity: 'info',
      title: '低温提醒',
      message: `当前 ${currentWeather.temp}°C，注意保暖。`,
      suggestedAction: '建议多穿衣物，优先安排室内活动',
      timestamp: Date.now(),
    });
  }

  return alerts;
}

// ── 时间自愈 ──

export function checkTimeHealing(
  plan: Plan,
  currentHour: number,
  currentMinute: number
): TripAlert[] {
  const alerts: TripAlert[] = [];
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  for (const activity of plan.activities) {
    if (!activity.timeLine) continue;

    // 解析活动时间
    const timeMatch = activity.timeLine.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;

    const endHour = parseInt(timeMatch[3]);
    const endMinute = parseInt(timeMatch[4]);
    const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    // 如果当前时间已超过活动结束时间，但活动未标记完成
    if (currentTimeStr > endTimeStr) {
      alerts.push({
        id: `time_${activity.id}_${Date.now()}`,
        type: 'time_overrun',
        severity: 'warning',
        title: `时间超支：${activity.title}`,
        message: `${activity.title} 的计划时间（${activity.timeLine}）已过，当前 ${currentTimeStr}。`,
        affectedActivityId: activity.id,
        suggestedAction: '建议跳过或压缩后续活动时间',
        timestamp: Date.now(),
      });
    }

    // 即将开始的活动提醒（30分钟内）
    const startHour = parseInt(timeMatch[1]);
    const startMinute = parseInt(timeMatch[2]);
    const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

    if (currentTimeStr < startTimeStr) {
      const diffMinutes = (startHour - currentHour) * 60 + (startMinute - currentMinute);
      if (diffMinutes > 0 && diffMinutes <= 30) {
        alerts.push({
          id: `upcoming_${activity.id}_${Date.now()}`,
          type: 'custom',
          severity: 'info',
          title: `即将开始：${activity.title}`,
          message: `${activity.title} 将在 ${diffMinutes} 分钟后开始（${startTimeStr}）。`,
          affectedActivityId: activity.id,
          suggestedAction: activity.type === 'food' ? '建议提前确认是否有位' : '建议提前出发',
          timestamp: Date.now(),
        });
      }
    }
  }

  return alerts;
}

// ── 高峰时段检测 ──

export function checkCrowdAlerts(plan: Plan, currentHour: number): TripAlert[] {
  const alerts: TripAlert[] = [];

  const isLunchPeak = currentHour >= 11 && currentHour <= 13;
  const isDinnerPeak = currentHour >= 17 && currentHour <= 19;

  const foodActivities = plan.activities.filter((a) => a.type === 'food');
  if ((isLunchPeak || isDinnerPeak) && foodActivities.length > 0) {
    const peakLabel = isLunchPeak ? '午餐' : '晚餐';
    alerts.push({
      id: `crowd_${peakLabel}_${Date.now()}`,
      type: 'crowd',
      severity: 'info',
      title: `${peakLabel}高峰提醒`,
      message: `当前是${peakLabel}高峰时段（${isLunchPeak ? '11:00-13:00' : '17:00-19:00'}），热门餐厅可能排队 15-30 分钟。`,
      suggestedAction: '建议提前预约或选择非热门餐厅',
      timestamp: Date.now(),
    });
  }

  return alerts;
}

// ── AI 替代方案生成 ──

export async function generateAlternativeActivity(
  originalActivity: Activity,
  reason: string,
  city: string
): Promise<Partial<Activity>[]> {
  const systemPrompt = `你是本地生活推荐专家。用户原计划去 "${originalActivity.title}"（${originalActivity.type}），但因为"${reason}"需要替代方案。
城市：${city}
原计划预算：¥${originalActivity.price}
原计划标签：${(originalActivity.tags || []).join('、')}

推荐 2-3 个替代方案，返回 JSON 数组：
[{"title":"替代地点","type":"food/activity","description":"为什么推荐这里","price":预估价格,"tags":["标签"]}]`;

  try {
    const raw = await callDashScope(systemPrompt, sanitizeUserInput(reason, 200), true);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ── 综合健康检查 ──

export async function checkTripHealth(
  plan: Plan,
  weather?: WeatherInfo,
  completedIds: Set<string> = new Set(),
  bookedIds: Set<string> = new Set()
): Promise<TripHealthStatus> {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // 并行执行各维度检查
  const [weatherAlerts, timeAlerts, crowdAlerts] = await Promise.all([
    checkWeatherHealing(plan, weather),
    Promise.resolve(checkTimeHealing(plan, currentHour, currentMinute)),
    Promise.resolve(checkCrowdAlerts(plan, currentHour)),
  ]);

  const allAlerts = [...weatherAlerts, ...timeAlerts, ...crowdAlerts];

  // 计算时间缓冲
  const completedCount = completedIds.size;
  const totalCount = plan.activities.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const expectedProgress = currentHour >= 8 && currentHour <= 22 ? (currentHour - 8) / 14 : 0.5;
  const timeBuffer = Math.round((expectedProgress - progress) * 60);

  // 计算预算
  const spentAmount = plan.activities
    .filter((a) => completedIds.has(a.id) || bookedIds.has(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  const budgetRemaining = plan.totalPrice - spentAmount;

  // 整体健康状态
  const criticalAlerts = allAlerts.filter((a) => a.severity === 'critical');
  const warningAlerts = allAlerts.filter((a) => a.severity === 'warning');
  let overallHealth: TripHealthStatus['overallHealth'] = 'healthy';
  if (criticalAlerts.length > 0) overallHealth = 'at_risk';
  else if (warningAlerts.length > 0) overallHealth = 'attention';

  // 推荐建议
  const recommendations: string[] = [];
  if (timeBuffer < -30) recommendations.push('进度落后较多，建议压缩后续活动或跳过低优先级项目');
  if (budgetRemaining < 50) recommendations.push('预算即将用完，后续活动注意控制消费');
  if (weatherAlerts.length > 0) recommendations.push(weatherAlerts[0].suggestedAction || '');
  if (crowdAlerts.length > 0) recommendations.push(crowdAlerts[0].suggestedAction || '');

  return {
    overallHealth,
    alerts: allAlerts,
    recommendations: recommendations.filter(Boolean),
    timeBuffer,
    budgetRemaining,
    weatherRisk:
      weatherAlerts.length > 0
        ? weatherAlerts[0].severity === 'critical'
          ? 'high'
          : weatherAlerts[0].severity === 'warning'
            ? 'medium'
            : 'low'
        : 'none',
  };
}
