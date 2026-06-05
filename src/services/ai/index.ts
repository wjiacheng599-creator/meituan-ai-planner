// Re-export all types
export type {
  Activity,
  Plan,
  CopilotMessage,
  CompareResult,
  AIStoryContent,
  WeatherInfo,
  ServiceIntent,
  IntentRule,
  DetectedIntent,
  WeatherImpactAssessment,
  PlanningContext,
} from './types';

// Re-export core functions
export { sanitizeUserInput, callDashScope, callDashScopeStreaming } from './core';

// Re-export provider abstraction
export {
  getAIProvider,
  setAIProvider,
  resetAIProvider,
  DashScopeProvider,
  LongCatProvider,
  MockProvider,
  CascadingProvider,
  getModelHealthStatus,
} from './provider';
export type { AIProvider, AIChatOptions, AIStreamOptions } from './provider';

// Re-export multi-agent
export { generatePlanWithMultiAgent, generatePlanWithMultiAgentStreaming } from './multiAgent';
export type {
  MultiAgentPlanResult,
  PlaceAgentResult,
  WeatherAgentResult,
  StrategyAgentResult,
} from './multiAgent';

// Re-export Travel DNA
export { generateTravelDNA, dnaToPromptContext } from './travelDNA';
export type { TravelDNA } from './travelDNA';

// Re-export self-healing
export {
  checkTripHealth,
  checkWeatherHealing,
  checkTimeHealing,
  checkCrowdAlerts,
  generateAlternativeActivity,
} from './selfHealing';
export type { TripAlert, TripHealthStatus, HealingSuggestion, AlertSeverity } from './selfHealing';

// Re-export weather functions
export {
  assessWeatherImpact,
  fetchWeather,
  getWeatherIcon,
  getWeatherAdvice,
  getUserCity,
} from './weather';

// Re-export intent functions
export {
  detectIntent,
  detectIntentHybrid,
  handleMultiIntents,
  handleServiceIntent,
} from './intent';

// Re-export plan generator functions
export { generatePlan, generatePlanStreaming, generatePlanLocally } from './planGenerator';

// Re-export copilot functions
export { chatWithCopilot, chatWithCopilotLocally } from './copilot';

// Re-export home chat functions
export { chatInHome, chatInHomeLocally } from './homeChat';

// Re-export story functions
export { generateAIStory, generateAIStoryLocally } from './story';

// Re-export alternatives functions
export { generateAlternatives, generateAlternativesLocally } from './alternatives';

// Re-export utility functions
export { stripMarkdown } from './utils';

// Re-export mock data functions (for external use if needed)
export {
  generateRestaurantMockData,
  generateDeliveryMockData,
  generateTicketMockData,
  generateCouponMockData,
} from './mockData';

// Re-export searchDestinations and compareWithAI (these are standalone functions that were in the original file)
import { searchSmartNearby, dataSource } from '../apiAdapter';
import { getUserCity } from './weather';
import { generateRestaurantMockData, generateTicketMockData } from './mockData';
import { sanitizeUserInput, callDashScope } from './core';
import { stripMarkdown, formatPoiDistance } from './utils';
import { seededFloat, seededInt } from '../../utils/seededRandom';
import { withServerFallback } from '../../utils/withServerFallback';
import {
  generateAlternativesViaServer,
  generateStoryViaServer,
  chatWithCopilotViaServer,
} from '../serverApi';
import { LRUCache } from '../../utils/lruCache';
import { CompareResult, Activity, CopilotMessage, WeatherInfo, AIStoryContent } from './types';
import { cachedSearchPOI } from './cache';

export async function searchDestinations(
  interests: string[],
  keywords: string
): Promise<{
  count: number;
  topRated: Array<{ name: string; rating: number; distance: string; category: string }>;
  categories: string[];
}> {
  const city = await getUserCity();
  // [PERF-OPT] Use cached search for POI deduplication
  const [restaurantPois, activityPois] = await Promise.all([
    dataSource.hasAmap
      ? cachedSearchPOI(keywords || interests.join(' '), city, 5000)
      : Promise.resolve([]),
    dataSource.hasAmap
      ? cachedSearchPOI(`${keywords || interests.join(' ')} 展览 景点`, city, 5000)
      : Promise.resolve([]),
  ]);

  const restaurants =
    restaurantPois.length > 0
      ? restaurantPois.slice(0, 6).map((poi) => ({
          name: poi.name,
          rating: parseFloat(poi.rating || '4.5'),
          distance: formatPoiDistance(poi.distance),
          category: poi.type.split(';')[0] || '餐饮',
        }))
      : generateRestaurantMockData(keywords, city).map((r) => ({
          name: r.name,
          rating: r.rating,
          distance: r.distance,
          category: r.category,
        }));

  const tickets =
    activityPois.length > 0
      ? activityPois.slice(0, 4).map((poi) => ({
          name: poi.name,
          rating: parseFloat(poi.rating || '4.5'),
          distance: formatPoiDistance(poi.distance),
          category: poi.type.split(';')[0] || '景点',
        }))
      : generateTicketMockData(keywords, city).map((t) => ({
          name: t.name,
          rating: t.rating,
          distance: '2-5km',
          category: '景点',
        }));

  const allItems = [...restaurants, ...tickets];

  const sorted = allItems.sort((a, b) => b.rating - a.rating);
  const categories = [...new Set(sorted.map((i) => i.category))];

  return {
    count: sorted.length,
    topRated: sorted.slice(0, 5),
    categories,
  };
}

export async function compareWithAI(items: string[]): Promise<CompareResult> {
  const sanitizedItems = items.map((item) => sanitizeUserInput(item, 200));

  const systemPrompt = `你是美团本地生活 AI 助手。从评分、价格、优劣势等方面对比分析商家/地点，给出推荐结论。
返回 JSON：
{"items": [{"name":"名称","rating":"4.8/5.0","priceRange":"人均 ¥128","highlights":["优势1"],"drawbacks":["劣势1"],"recommendation":"适合人群"}], "aiVerdict":"推荐结论"}`;

  const userPrompt = `请对比以下商家/地点：\n${sanitizedItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;

  try {
    const rawText = await callDashScope(systemPrompt, userPrompt, true);
    const result = JSON.parse(rawText) as CompareResult;
    result.aiVerdict = stripMarkdown(result.aiVerdict);
    result.items = result.items.map((it) => ({
      ...it,
      name: stripMarkdown(it.name),
      recommendation: stripMarkdown(it.recommendation),
    }));
    return result;
  } catch {
    return {
      items: items.map((name, index) => ({
        name,
        rating: `${seededFloat(`${name}${index}rating`, 4.2, 4.8)}/5.0`,
        priceRange: `人均 ¥${seededInt(`${name}${index}price`, 58, 168)}`,
        highlights: index % 2 === 0 ? ['口碑稳定', '位置好找'] : ['氛围更强', '适合停留更久'],
        drawbacks: index % 2 === 0 ? ['高峰期可能排队'] : ['价格略高'],
        recommendation: index === 0 ? '更适合直接出发的稳妥选择' : '更适合有明确偏好时选择',
      })),
      aiVerdict: '优先看距离、预算和当前场景；如果想减少试错，先选更近且评分更稳的一家。',
    };
  }
}
export { runGuardrails, classifyToolRisk } from './guardrails';
