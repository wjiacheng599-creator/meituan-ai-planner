/**
 * Multi-Agent 行程生成架构
 *
 * 参照 TripStar 的多 Agent 并行模式，将行程生成拆分为 3 个并行 Agent：
 * 1. 场所 Agent - 搜索真实 POI 数据，筛选排序
 * 2. 天气 Agent - 获取天气数据，评估影响
 * 3. 策略 Agent - 分析预算和时间分配
 *
 * 主 Agent 汇总所有结果，生成最终行程。
 *
 * 优势：
 * - 并行执行，减少总耗时
 * - 各 Agent 专注单一职责，提升质量
 * - 结构化中间结果，便于调试和缓存
 */
import { callDashScope, callDashScopeStreaming, sanitizeUserInput } from './core';
import { fetchWeather, getUserCity } from './weather';
import { cachedSearchPOI } from './cache';
import { dataSource } from '../apiAdapter';
import type { Plan, WeatherInfo } from './types';

// ── 中间结果类型 ──

export interface PlaceAgentResult {
  places: Array<{
    name: string;
    type: string; // food / activity / transit
    category: string;
    address: string;
    rating: number;
    priceRange: string;
    tags: string[];
    whyRecommended: string;
    bestTime: string;
    crowdLevel: 'low' | 'medium' | 'high';
  }>;
  summary: string;
}

export interface WeatherAgentResult {
  weather: WeatherInfo;
  impact: {
    level: 'none' | 'low' | 'medium' | 'high';
    outdoorFriendly: boolean;
    recommendations: string[];
    bestTimeWindow: string;
    indoorAlternatives: string[];
  };
  summary: string;
}

export interface StrategyAgentResult {
  budgetBreakdown: {
    food: number;
    activity: number;
    transport: number;
    total: number;
  };
  timeAllocation: {
    totalHours: number;
    activitySlots: Array<{ start: string; end: string; type: string }>;
    bufferTime: number; // 分钟
  };
  tips: string[];
  summary: string;
}

export interface MultiAgentPlanResult {
  plan: Plan;
  agentResults: {
    places: PlaceAgentResult;
    weather: WeatherAgentResult;
    strategy: StrategyAgentResult;
  };
  meta: {
    totalTime: number;
    agentsUsed: string[];
    modelUsed: string;
  };
}

// ── 场所 Agent ──

async function runPlaceAgent(
  query: string,
  city: string,
  interests: string[],
  signal?: AbortSignal
): Promise<PlaceAgentResult> {
  // 先搜索真实 POI
  let poiContext = '';
  if (dataSource.hasAmap) {
    try {
      const keywords = interests.length > 0 ? interests.join(' ') : query;
      const [foodPois, activityPois] = await Promise.all([
        cachedSearchPOI(keywords, city, 5000),
        cachedSearchPOI(`${keywords} 景点 展览`, city, 5000),
      ]);

      if (foodPois.length > 0 || activityPois.length > 0) {
        const foodList = foodPois
          .slice(0, 5)
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} - ${p.type} - 评分${p.rating || '4.5'} - ${p.address || '地址未知'}`
          )
          .join('\n');
        const activityList = activityPois
          .slice(0, 5)
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} - ${p.type} - 评分${p.rating || '4.5'} - ${p.address || '地址未知'}`
          )
          .join('\n');

        poiContext = `
【真实 POI 数据】这些是${city}的真实商家/景点：
餐饮：
${foodList || '暂无数据'}
活动景点：
${activityList || '暂无数据'}

你必须从上面的真实 POI 中选择，不得虚构地点。`;
      }
    } catch (error) {
      console.warn('[MultiAgent] POI 搜索失败:', error);
    }
  }

  const systemPrompt = `你是场所推荐专家。根据用户需求和真实 POI 数据，筛选并排序最佳去处。
${poiContext}
城市：${city}

返回 JSON：
{
  "places": [
    {
      "name": "地点名称",
      "type": "food/activity/transit",
      "category": "类别",
      "address": "地址",
      "rating": 4.5,
      "priceRange": "人均¥80-120",
      "tags": ["标签1", "标签2"],
      "whyRecommended": "推荐理由",
      "bestTime": "最佳到访时间",
      "crowdLevel": "low/medium/high"
    }
  ],
  "summary": "场所推荐总结"
}`;

  const raw = await callDashScope(systemPrompt, sanitizeUserInput(query, 300), true, signal);
  try {
    return JSON.parse(raw);
  } catch {
    return { places: [], summary: '场所推荐暂时不可用' };
  }
}

// ── 天气 Agent ──

async function runWeatherAgent(city: string, signal?: AbortSignal): Promise<WeatherAgentResult> {
  let weather: WeatherInfo;
  try {
    weather = await fetchWeather(city);
  } catch {
    weather = {
      city,
      temp: 22,
      condition: '晴',
      humidity: 50,
      tempRange: '18~26°C',
      advice: '天气数据暂时不可用',
      icon: '☀️',
    };
  }

  const systemPrompt = `你是天气影响分析专家。根据天气数据评估对出行的影响。
城市：${city}
天气：${weather.condition}，${weather.temp}°C，湿度${weather.humidity}%，${weather.tempRange}
建议：${weather.advice}

返回 JSON：
{
  "weather": { "city": "${city}", "temp": ${weather.temp}, "condition": "${weather.condition}", "humidity": ${weather.humidity}, "tempRange": "${weather.tempRange}", "advice": "${weather.advice}" },
  "impact": {
    "level": "none/low/medium/high",
    "outdoorFriendly": true,
    "recommendations": ["建议1", "建议2"],
    "bestTimeWindow": "最佳出行时段",
    "indoorAlternatives": ["室内替代1", "室内替代2"]
  },
  "summary": "天气影响总结"
}`;

  const raw = await callDashScope(systemPrompt, `分析${city}今日天气对出行的影响`, true, signal);
  try {
    const parsed = JSON.parse(raw);
    return { ...parsed, weather };
  } catch {
    return {
      weather,
      impact: {
        level: 'none',
        outdoorFriendly: true,
        recommendations: [],
        bestTimeWindow: '全天',
        indoorAlternatives: [],
      },
      summary: `${city}${weather.condition}，${weather.temp}°C`,
    };
  }
}

// ── 策略 Agent ──

async function runStrategyAgent(
  query: string,
  placeResult: PlaceAgentResult,
  weatherResult: WeatherAgentResult,
  memberCount: number,
  signal?: AbortSignal
): Promise<StrategyAgentResult> {
  const placeNames = placeResult.places.map((p) => p.name).join('、');
  const weatherSummary = weatherResult.summary;
  const outdoorOk = weatherResult.impact.outdoorFriendly;

  const systemPrompt = `你是行程策略规划师。根据场所推荐和天气情况，优化预算和时间分配。
用户需求：${query}
可用场所：${placeNames}
天气情况：${weatherSummary}（户外${outdoorOk ? '友好' : '不友好'}）
出行人数：${memberCount}人

返回 JSON：
{
  "budgetBreakdown": { "food": 200, "activity": 100, "transport": 30, "total": 330 },
  "timeAllocation": {
    "totalHours": 5,
    "activitySlots": [
      { "start": "14:00", "end": "16:00", "type": "activity" },
      { "start": "16:30", "end": "18:00", "type": "food" }
    ],
    "bufferTime": 15
  },
  "tips": ["实用建议1", "实用建议2"],
  "summary": "策略总结"
}`;

  const raw = await callDashScope(systemPrompt, sanitizeUserInput(query, 300), true, signal);
  try {
    return JSON.parse(raw);
  } catch {
    return {
      budgetBreakdown: { food: 200, activity: 100, transport: 30, total: 330 },
      timeAllocation: { totalHours: 5, activitySlots: [], bufferTime: 15 },
      tips: [],
      summary: '策略分析暂时不可用',
    };
  }
}

// ── 主 Agent（汇总生成最终行程） ──

async function synthesizePlan(
  query: string,
  city: string,
  placeResult: PlaceAgentResult,
  weatherResult: WeatherAgentResult,
  strategyResult: StrategyAgentResult,
  signal?: AbortSignal
): Promise<Plan> {
  const systemPrompt = `你是美团本地生活规划师。根据以下三个专家的分析结果，生成完整行程。

【场所推荐】
${JSON.stringify(placeResult.places.slice(0, 8), null, 2)}

【天气影响】
${weatherResult.summary}
户外友好：${weatherResult.impact.outdoorFriendly ? '是' : '否'}
最佳时段：${weatherResult.impact.bestTimeWindow}
${weatherResult.impact.recommendations.join('；')}

【策略建议】
预算分配：餐饮¥${strategyResult.budgetBreakdown.food} + 活动¥${strategyResult.budgetBreakdown.activity} + 交通¥${strategyResult.budgetBreakdown.transport} = 总计¥${strategyResult.budgetBreakdown.total}
时长：${strategyResult.timeAllocation.totalHours}小时
${strategyResult.tips.join('；')}

城市：${city}
用户需求：${query}

生成完整行程，返回 JSON：
{
  "title": "行程标题",
  "durationTags": "约5小时",
  "tags": ["标签1", "标签2"],
  "summary": "一句话总结",
  "city": "${city}",
  "strategy": "规划策略说明",
  "conflictResolution": "冲突调和说明",
  "activities": [
    {
      "id": "1",
      "timeLine": "14:00-16:00",
      "title": "地点名称",
      "type": "food/activity/travel",
      "description": "活动描述",
      "price": 80,
      "distanceInfo": "距离2.5km",
      "tags": ["标签"],
      "reasoning": "选择理由",
      "teamFit": "适配说明",
      "tips": ["避坑提示"],
      "bestVisitTime": "最佳时间",
      "crowdLevel": "low/medium/high"
    }
  ],
  "totalPrice": 330,
  "uiStrategy": { "variant": "default", "emphasis": [], "warnings": [], "suggestedActions": [] }
}`;

  const raw = await callDashScope(systemPrompt, sanitizeUserInput(query, 300), true, signal);
  const parsed = JSON.parse(raw);

  return {
    id: `multi_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    title: parsed.title || '出行计划',
    durationTags: parsed.durationTags || `约${strategyResult.timeAllocation.totalHours}小时`,
    tags: parsed.tags || [],
    summary: parsed.summary || '',
    city: city,
    activities: (parsed.activities || []).map((a: Record<string, unknown>, i: number) => ({
      id: String(a.id || String(i + 1)),
      timeLine: String(a.timeLine || ''),
      title: String(a.title || ''),
      type: (['food', 'activity', 'travel'].includes(String(a.type)) ? a.type : 'activity') as
        | 'food'
        | 'activity'
        | 'travel',
      description: String(a.description || ''),
      price: Number(a.price) || 0,
      distanceInfo: a.distanceInfo ? String(a.distanceInfo) : undefined,
      tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
      reasoning: a.reasoning ? String(a.reasoning) : undefined,
      teamFit: a.teamFit ? String(a.teamFit) : undefined,
      tips: Array.isArray(a.tips) ? a.tips.map(String) : undefined,
      bestVisitTime: a.bestVisitTime ? String(a.bestVisitTime) : undefined,
      crowdLevel: a.crowdLevel as 'low' | 'medium' | 'high' | undefined,
    })),
    totalPrice: Number(parsed.totalPrice) || strategyResult.budgetBreakdown.total,
    strategy: parsed.strategy || strategyResult.summary,
    conflictResolution: parsed.conflictResolution || '全员偏好一致',
    uiStrategy: parsed.uiStrategy,
  };
}

// ── 公开 API ──

/**
 * 使用 Multi-Agent 架构生成行程
 * 3 个 Agent 并行执行，主 Agent 汇总生成最终结果
 */
export async function generatePlanWithMultiAgent(
  query: string,
  cityParam?: string,
  interests: string[] = [],
  memberCount: number = 1,
  signal?: AbortSignal
): Promise<MultiAgentPlanResult> {
  const startTime = Date.now();
  const city = cityParam || (await getUserCity());

  // Phase 1: 3 个 Agent 并行执行
  const [placeResult, weatherResult] = await Promise.all([
    runPlaceAgent(query, city, interests, signal),
    runWeatherAgent(city, signal),
  ]);

  // Phase 2: 策略 Agent 依赖场所和天气结果
  const strategyResult = await runStrategyAgent(
    query,
    placeResult,
    weatherResult,
    memberCount,
    signal
  );

  // Phase 3: 主 Agent 汇总生成行程
  const plan = await synthesizePlan(
    query,
    city,
    placeResult,
    weatherResult,
    strategyResult,
    signal
  );

  return {
    plan,
    agentResults: { places: placeResult, weather: weatherResult, strategy: strategyResult },
    meta: {
      totalTime: Date.now() - startTime,
      agentsUsed: ['place', 'weather', 'strategy', 'synthesizer'],
      modelUsed: 'multi-agent',
    },
  };
}

/**
 * 使用 Multi-Agent 架构流式生成行程（SSE 版本）
 */
export async function generatePlanWithMultiAgentStreaming(
  query: string,
  cityParam?: string,
  interests: string[] = [],
  memberCount: number = 1,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<MultiAgentPlanResult> {
  const startTime = Date.now();
  const city = cityParam || (await getUserCity());

  // Phase 1: 并行
  onChunk?.('🔍 正在搜索场所和天气...\n');
  const [placeResult, weatherResult] = await Promise.all([
    runPlaceAgent(query, city, interests, signal),
    runWeatherAgent(city, signal),
  ]);

  // Phase 2: 策略
  onChunk?.('📊 正在优化预算和时间...\n');
  const strategyResult = await runStrategyAgent(
    query,
    placeResult,
    weatherResult,
    memberCount,
    signal
  );

  // Phase 3: 汇总（流式）
  onChunk?.('✨ 正在生成行程方案...\n');
  const systemPrompt = `你是美团本地生活规划师。根据以下专家分析结果生成行程。
场所：${JSON.stringify(placeResult.places.slice(0, 6))}
天气：${weatherResult.summary}
策略：预算¥${strategyResult.budgetBreakdown.total}，${strategyResult.timeAllocation.totalHours}小时
城市：${city}`;

  let planJson = '';
  const rawResult = await callDashScopeStreaming(
    systemPrompt,
    sanitizeUserInput(query, 300),
    (chunk) => {
      planJson += chunk;
      onChunk?.(chunk);
    },
    true,
    signal
  );

  let plan: Plan;
  try {
    const parsed = JSON.parse(rawResult || planJson);
    plan = {
      id: `multi_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: parsed.title || '出行计划',
      durationTags: parsed.durationTags || `约${strategyResult.timeAllocation.totalHours}小时`,
      tags: parsed.tags || [],
      summary: parsed.summary || '',
      city,
      activities: (parsed.activities || []).map((a: Record<string, unknown>, i: number) => ({
        id: String(a.id || String(i + 1)),
        timeLine: String(a.timeLine || ''),
        title: String(a.title || ''),
        type: (['food', 'activity', 'travel'].includes(String(a.type)) ? a.type : 'activity') as
          | 'food'
          | 'activity'
          | 'travel',
        description: String(a.description || ''),
        price: Number(a.price) || 0,
        tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
      })),
      totalPrice: Number(parsed.totalPrice) || strategyResult.budgetBreakdown.total,
      strategy: parsed.strategy || strategyResult.summary,
      conflictResolution: parsed.conflictResolution || '全员偏好一致',
    };
  } catch {
    throw new Error('行程生成失败：AI 返回格式异常');
  }

  return {
    plan,
    agentResults: { places: placeResult, weather: weatherResult, strategy: strategyResult },
    meta: {
      totalTime: Date.now() - startTime,
      agentsUsed: ['place', 'weather', 'strategy', 'synthesizer'],
      modelUsed: 'multi-agent-streaming',
    },
  };
}
