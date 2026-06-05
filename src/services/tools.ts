import { API_BASE } from "./apiBase";
import type { Activity } from './ai';
import {
  searchPOI,
  getMockPOI,
  dataSource,
  planMultiPointRoute,
  type POIResult,
} from './apiAdapter';
import type { AgentStep } from './agent';

/** Demo 模式：已知不可用列表（确保比赛演示时100%触发） */
const DEMO_UNAVAILABLE: Record<string, { message: string }> = {
  故宫: { message: '故宫今日门票已售罄（周末提前3天售完），建议选择替代景点' },
  长城: { message: '八达岭长城今日无票，建议改日或选择慕田峪长城' },
  全聚德: { message: '全聚德晚餐时段已满座（18:00-20:00），建议换时段或替代餐厅' },
  海底捞: { message: '海底捞晚餐高峰期已满座，排队超2小时，建议换替代火锅店' },
  颐和园: { message: '颐和园今日门票已售罄，临近节假日请提前预订' },
};

export type ToolName =
  | 'search_restaurant'
  | 'check_availability'
  | 'make_reservation'
  | 'check_queue'
  | 'join_queue'
  | 'book_activity'
  | 'order_delivery'
  | 'dispatch_taxi'
  | 'calculate_route'
  | 'search_hotel'
  | 'book_hotel';

export type ToolStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface ToolCall {
  id: string;
  tool: ToolName;
  label: string;
  icon: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  result?: ToolResult;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface ExecutionPlan {
  id: string;
  planTitle: string;
  calls: ToolCall[];
  status: 'pending' | 'running' | 'completed' | 'partial_failed';
  completedAt?: number;
}

function matchesName(callName: unknown, stepName: unknown): boolean {
  const a = String(callName || '');
  const b = String(stepName || '');
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function findCallIndex(calls: ToolCall[], step: AgentStep): number {
  const stepToolName = step.toolName;
  const stepArgs = step.toolArgs;

  const pendingOrRunning = calls.filter((c) => c.status === 'pending' || c.status === 'running');

  if (stepToolName === 'calculate_route') {
    const idx = pendingOrRunning.findIndex((c) => c.tool === 'calculate_route');
    if (idx >= 0) return calls.indexOf(pendingOrRunning[idx]);
  }

  if (stepToolName === 'dispatch_taxi' && stepArgs) {
    const from = String(stepArgs.from || '');
    const to = String(stepArgs.to || '');
    const idx = pendingOrRunning.findIndex(
      (c) =>
        c.tool === 'dispatch_taxi' &&
        String(c.input.from || '').includes(from) &&
        String(c.input.to || '').includes(to)
    );
    if (idx >= 0) return calls.indexOf(pendingOrRunning[idx]);
  }

  if (stepToolName && stepArgs) {
    const stepName = stepArgs.name;
    const idx = pendingOrRunning.findIndex(
      (c) => c.tool === stepToolName && matchesName(c.input.name, stepName)
    );
    if (idx >= 0) return calls.indexOf(pendingOrRunning[idx]);
  }

  return -1;
}

type IdempotentTool =
  | 'search_restaurant'
  | 'check_availability'
  | 'check_queue'
  | 'calculate_route'
  | 'search_hotel';
type NonIdempotentTool =
  | 'make_reservation'
  | 'join_queue'
  | 'book_activity'
  | 'order_delivery'
  | 'dispatch_taxi'
  | 'book_hotel';

const IDEMPOTENT_TOOLS: Set<ToolName> = new Set([
  'search_restaurant',
  'check_availability',
  'check_queue',
  'calculate_route',
  'search_hotel',
]);

const NON_IDEMPOTENT_TOOLS: Set<ToolName> = new Set([
  'make_reservation',
  'join_queue',
  'book_activity',
  'order_delivery',
  'dispatch_taxi',
  'book_hotel',
]);

const pendingRequests = new Map<
  string,
  {
    promise: Promise<ToolResult>;
    timestamp: number;
    status: 'pending' | 'completed' | 'failed';
  }
>();

const completedNonIdempotentRequests = new Map<string, { result: ToolResult; timestamp: number }>();
const NON_IDEMPOTENT_RESULT_TTL_MS = 5 * 60 * 1000;

function generateIdempotencyKey(tool: ToolName, input: Record<string, unknown>): string {
  const normalizedInput = Object.keys(input)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {});
  const base = `${tool}|${JSON.stringify(normalizedInput)}`;

  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash | 0;
  }
  return `${tool}_${Math.abs(hash).toString(36)}`;
}

function isNonIdempotentTool(tool: ToolName): boolean {
  return NON_IDEMPOTENT_TOOLS.has(tool);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomSuccess(probability = 0.92): boolean {
  return Math.random() < probability;
}

async function searchRestaurant(input: {
  name: string;
  city: string;
  people: number;
}): Promise<ToolResult> {
  let pois: POIResult[] = [];

  if (dataSource.hasAmap) {
    pois = await searchPOI(input.name, input.city, '050000');
    if (pois.length === 0) {
      pois = await searchPOI(input.name, input.city);
    }
  }

  if (pois.length === 0) {
    pois = getMockPOI(input.name, input.city);
  }

  if (!dataSource.hasAmap && !randomSuccess(0.98)) {
    return { success: false, message: `${input.name} 暂时无法查询，请稍后重试` };
  }

  const best = pois[0];
  const rating = best.rating;
  const waitTime = Math.floor(Math.random() * 30);
  const source = dataSource.hasAmap ? '高德地图' : 'Mock';

  return {
    success: true,
    message: `已找到，评分 ${rating}/5.0，${input.people}人桌${waitTime > 0 ? `等待约 ${waitTime} 分钟` : '当前有位'}`,
    data: {
      rating,
      waitTime,
      seatsAvailable: waitTime === 0,
      phone: best.phone,
      address: best.address,
      poiName: best.name,
      avgCost: best.cost,
      location: best.location,
      source,
    },
  };
}

async function checkAvailability(input: {
  name: string;
  time: string;
  people: number;
}): Promise<ToolResult> {
  // Demo 模式：检查已知不可用列表（返回警示但不阻止流程）
  for (const [keyword] of Object.entries(DEMO_UNAVAILABLE)) {
    if (input.name.includes(keyword)) {
      return {
        success: true, // 允许继续，实际故障在 make_reservation 触发
        message: `${input.time} · 时段紧张，建议尽快预订`,
        data: { tableType: input.people > 4 ? '大桌' : '小桌', location: '靠窗', warning: true },
      };
    }
  }
  // 非 Demo 项目保留随机失败
  if (!randomSuccess(0.98)) {
    return { success: false, message: `${input.time} 暂无空位` };
  }
  return {
    success: true,
    message: `${input.time} · ${input.people}人可订`,
    data: { tableType: input.people > 4 ? '大桌' : '小桌', location: '靠窗' },
  };
}

async function makeReservation(input: {
  name: string;
  time: string;
  people: number;
  contact: string;
}): Promise<ToolResult> {
  // Demo 模式：检查已知不可用列表
  for (const [keyword, config] of Object.entries(DEMO_UNAVAILABLE)) {
    if (input.name.includes(keyword)) {
      return { success: false, message: config.message };
    }
  }
  if (!randomSuccess(0.98)) {
    return { success: false, message: `预订失败，该时段已满` };
  }
  const confirmCode = 'MT' + Date.now().toString(36).toUpperCase().slice(-6);
  return {
    success: true,
    message: `已成功预订，${input.time} · ${input.people}人`,
    data: { confirmCode, restaurant: input.name, time: input.time, people: input.people },
  };
}

async function checkQueue(input: { name: string }): Promise<ToolResult> {
  const queueLength = Math.floor(Math.random() * 15);
  const waitMinutes = queueLength * (3 + Math.floor(Math.random() * 5));
  return {
    success: true,
    message: queueLength === 0 ? `当前无需排队` : `排队 ${queueLength} 桌，约 ${waitMinutes} 分钟`,
    data: { queueLength, waitMinutes },
  };
}

async function joinQueue(input: {
  name: string;
  people: number;
  contact: string;
}): Promise<ToolResult> {
  if (!randomSuccess(0.98)) {
    return { success: false, message: `取号失败，请到店扫码` };
  }
  const queueNum = 'A' + (Math.floor(Math.random() * 50) + 1).toString().padStart(3, '0');
  return {
    success: true,
    message: `已取号 ${queueNum}，约 ${Math.floor(Math.random() * 20) + 5} 分钟`,
    data: { queueNumber: queueNum },
  };
}

async function bookActivity(input: {
  name: string;
  time: string;
  people: number;
}): Promise<ToolResult> {
  // Demo 模式：检查已知不可用列表（比赛关键展示）
  for (const [keyword, config] of Object.entries(DEMO_UNAVAILABLE)) {
    if (input.name.includes(keyword)) {
      return { success: false, message: config.message };
    }
  }
  // 非 Demo 项目仍保留 2% 随机失败
  if (!randomSuccess(0.98)) {
    return { success: false, message: `预约失败，名额已满` };
  }
  const ticketId = 'TK' + Date.now().toString(36).toUpperCase().slice(-8);
  return {
    success: true,
    message: `已预约，${input.time} · ${input.people}人`,
    data: { ticketId, activity: input.name, time: input.time },
  };
}

async function orderDelivery(input: {
  item: string;
  deliverTo: string;
  time: string;
}): Promise<ToolResult> {
  // Demo 模式：外卖也可以触发故障
  for (const [keyword, config] of Object.entries(DEMO_UNAVAILABLE)) {
    if (input.item.includes(keyword)) {
      return { success: false, message: config.message };
    }
  }
  if (!randomSuccess(0.98)) {
    return { success: false, message: `${input.item} 配送下单失败` };
  }
  const orderId = 'DL' + Date.now().toString(36).toUpperCase().slice(-8);
  return {
    success: true,
    message: `已下单，${input.time} 送达`,
    data: { orderId, item: input.item, deliverTo: input.deliverTo },
  };
}

async function dispatchTaxi(input: {
  from: string;
  to: string;
  time: string;
  people: number;
  tierLabel?: string;
  estimatedFare?: number;
  estimatedWaitMinutes?: number;
}): Promise<ToolResult> {
  if (!randomSuccess(0.98)) {
    return { success: false, message: `当前车辆紧张，${input.from} 附近暂时无法立即叫车` };
  }
  const orderId = 'TX' + Date.now().toString(36).toUpperCase().slice(-8);
  return {
    success: true,
    message: `已预约${input.tierLabel || '车辆'}，约 ${input.estimatedWaitMinutes || 4} 分钟到达`,
    data: {
      orderId,
      from: input.from,
      to: input.to,
      people: input.people,
      tierLabel: input.tierLabel || '快车',
      estimatedFare: input.estimatedFare || 0,
      estimatedWaitMinutes: input.estimatedWaitMinutes || 4,
    },
  };
}

async function calculateRoute(input: {
  activities: string[];
  locations?: Array<{ lat: number; lng: number }>;
}): Promise<ToolResult> {
  const source = dataSource.hasAmap ? '高德地图' : 'Mock';

  try {
    const coords =
      input.locations ||
      input.activities.map((_name, i) => ({ lat: 39.9 + i * 0.01, lng: 116.4 + i * 0.01 }));
    const routeResult = await planMultiPointRoute(coords);

    return {
      success: true,
      message: `全程 ${routeResult.totalDuration} 分钟 · ${(routeResult.totalDistance / 1000).toFixed(1)} 公里`,
      data: {
        totalTravelMinutes: routeResult.totalDuration,
        totalDistance: routeResult.totalDistance,
        optimized: true,
        source,
        waypoints: input.activities,
        segments: routeResult.segments,
      },
    };
  } catch (err) {
    console.warn('[Tool] Route calculation failed:', err);
    const totalTime = Math.floor(Math.random() * 30) + 10;
    const totalDistance = Math.floor(Math.random() * 5000) + 500;
    return {
      success: true,
      message: `全程 ${totalTime} 分钟 · ${(totalDistance / 1000).toFixed(1)} 公里`,
      data: {
        totalTravelMinutes: totalTime,
        totalDistance,
        optimized: true,
        source: 'Mock',
        waypoints: input.activities,
      },
    };
  }
}

async function searchHotel(input: {
  city: string;
  keywords?: string;
  maxPrice?: number;
  minRating?: number;
}): Promise<ToolResult> {
  const { city, keywords = '酒店', maxPrice = 500, minRating = 4.0 } = input;

  try {
    const params = new URLSearchParams({ city, maxPrice: String(maxPrice) });
    if (keywords && keywords !== '酒店') params.set('keyword', keywords);
    const res = await fetch(`${API_BASE}/api/fliggy/hotels?${params}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length > 0) {
        const hotels = data.items.slice(0, 8).map((item: any, idx: number) => ({
          id: `fliggy_hotel_${idx}_${Date.now()}`,
          name: item.name,
          address: item.address,
          rating: parseFloat(item.score) || 4.5,
          price: parseInt(item.price?.replace(/[^\d]/g, '')) || maxPrice,
          location:
            item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : undefined,
          star: item.star,
          imageUrl: item.mainPic,
          bookingUrl: item.detailUrl,
          brand: item.brandName,
          nearbyPoi: item.interestsPoi,
        }));
        return {
          success: true,
          message: `从飞猪找到 ${hotels.length} 家酒店（实时价格）`,
          data: { hotels, source: 'fliggy' },
        };
      }
    }
  } catch (e) {
    console.warn('[searchHotel] 飞猪搜索失败，降级到高德:', e);
  }

  let pois: POIResult[] = [];
  if (dataSource.hasAmap) {
    pois = await searchPOI(keywords, city, '100000');
    if (pois.length === 0) pois = await searchPOI(keywords, city);
  }
  if (pois.length === 0) pois = getMockPOI(keywords, city);

  const hotels = pois
    .filter((poi) => {
      const ratingNum =
        typeof poi.rating === 'string' ? parseFloat(poi.rating) || 0 : poi.rating || 0;
      return ratingNum >= minRating;
    })
    .slice(0, 5)
    .map((poi, idx) => ({
      id: `hotel_${idx}_${Date.now()}`,
      name: poi.name,
      address: poi.address,
      rating: typeof poi.rating === 'string' ? parseFloat(poi.rating) || 4.5 : poi.rating || 4.5,
      price: typeof poi.cost === 'string' ? parseInt(poi.cost) || 300 : poi.cost || 300,
      location: poi.location,
    }));

  return {
    success: true,
    message: `找到 ${hotels.length} 家酒店`,
    data: { hotels, source: 'amap' },
  };
}

async function bookHotel(input: {
  hotelId: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  peopleCount: number;
  contact: string;
}): Promise<ToolResult> {
  if (!randomSuccess(0.95)) {
    return {
      success: false,
      message: `${input.hotelName} 暂无空房，请选择其他酒店`,
    };
  }

  const confirmCode = `HTL${Date.now().toString(36).toUpperCase()}`;

  return {
    success: true,
    message: `已成功预订 ${input.hotelName}，入住时间${input.checkIn}，退房时间${input.checkOut}`,
    data: {
      confirmCode,
      hotelId: input.hotelId,
      hotelName: input.hotelName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    },
  };
}

const toolHandlers: Record<ToolName, (input: Record<string, unknown>) => Promise<ToolResult>> = {
  search_restaurant: (input) =>
    searchRestaurant({
      name: (input.name as string) || '',
      city: (input.city as string) || '北京',
      people: Number(input.people) || 1,
    }),
  check_availability: (input) =>
    checkAvailability({
      name: (input.name as string) || '',
      time: (input.time as string) || '',
      people: Number(input.people) || 1,
    }),
  make_reservation: (input) =>
    makeReservation({
      name: (input.name as string) || '',
      time: (input.time as string) || '',
      people: Number(input.people) || 1,
      contact: input.contact as string,
    }),
  check_queue: (input) =>
    checkQueue({
      name: (input.name as string) || '',
    }),
  join_queue: (input) =>
    joinQueue({
      name: (input.name as string) || '',
      people: Number(input.people) || 1,
      contact: input.contact as string,
    }),
  book_activity: (input) =>
    bookActivity({
      name: (input.name as string) || '',
      time: (input.time as string) || '',
      people: Number(input.people) || 1,
    }),
  order_delivery: (input) =>
    orderDelivery({
      item: input.item as string,
      deliverTo: input.deliverTo as string,
      time: (input.time as string) || '',
    }),
  dispatch_taxi: (input) =>
    dispatchTaxi({
      from: input.from as string,
      to: input.to as string,
      time: (input.time as string) || '',
      people: Number(input.people) || 1,
      tierLabel: input.tierLabel as string | undefined,
      estimatedFare: input.estimatedFare as number | undefined,
      estimatedWaitMinutes: input.estimatedWaitMinutes as number | undefined,
    }),
  calculate_route: (input) => calculateRoute(input as { activities: string[] }),
  search_hotel: (input) =>
    searchHotel({
      city: (input.city as string) || '北京',
      keywords: input.keywords as string | undefined,
      maxPrice: input.maxPrice as number | undefined,
      minRating: input.minRating as number | undefined,
    }),
  book_hotel: (input) =>
    bookHotel(
      input as {
        hotelId: string;
        hotelName: string;
        checkIn: string;
        checkOut: string;
        peopleCount: number;
        contact: string;
      }
    ),
};

export function buildExecutionPlan(
  activities: Activity[],
  planTitle: string,
  peopleCount: number,
  options?: {
    city?: string;
    travelMode?: string;
  }
): ExecutionPlan {
  const calls: ToolCall[] = [];
  let callIdx = 0;
  const city = options?.city || '北京';

  calls.push({
    id: `call_${callIdx++}`,
    tool: 'calculate_route',
    label: '优化出行路线',
    icon: '🗺️',
    input: { activities: activities.map((a) => a.title) },
    status: 'pending',
  });

  for (const act of activities) {
    if (act.type === 'food') {
      calls.push({
        id: `call_${callIdx++}`,
        tool: 'search_restaurant',
        label: `查询 ${act.title}`,
        icon: '🔍',
        input: { name: act.title, city: city, people: peopleCount },
        status: 'pending',
      });
      calls.push({
        id: `call_${callIdx++}`,
        tool: 'check_availability',
        label: `${act.title} 可用时段`,
        icon: '📅',
        input: { name: act.title, time: act.timeLine, people: peopleCount },
        status: 'pending',
      });
      calls.push({
        id: `call_${callIdx++}`,
        tool: 'make_reservation',
        label: `预订 ${act.title}`,
        icon: '✅',
        input: { name: act.title, time: act.timeLine, people: peopleCount, contact: '138****8888' },
        status: 'pending',
      });
    } else {
      calls.push({
        id: `call_${callIdx++}`,
        tool: 'book_activity',
        label: `预约 ${act.title}`,
        icon: '🎟️',
        input: { name: act.title, time: act.timeLine, people: peopleCount },
        status: 'pending',
      });
    }
  }

  return {
    id: `exec_${Date.now()}`,
    planTitle,
    calls,
    status: 'pending',
  };
}

export async function executeToolCall(call: ToolCall): Promise<ToolCall> {
  const handler = toolHandlers[call.tool];
  if (!handler) {
    return { ...call, status: 'skipped', error: '未知工具' };
  }

  const running: ToolCall = { ...call, status: 'running', startedAt: Date.now() };
  try {
    const result = await handler(call.input);
    return {
      ...running,
      status: result.success ? 'success' : 'failed',
      result,
      finishedAt: Date.now(),
      error: result.success ? undefined : result.message,
    };
  } catch (err) {
    return {
      ...running,
      status: 'failed',
      error: err instanceof Error ? err.message : '执行失败',
      finishedAt: Date.now(),
    };
  }
}

function exponentialBackoff(attempt: number, baseMs: number = 1000): number {
  return baseMs * Math.pow(2, attempt) + Math.random() * 500;
}

export interface ExecutePlanOptions {
  signal?: AbortSignal;
}

export async function executePlan(
  plan: ExecutionPlan,
  onProgress: (plan: ExecutionPlan) => void,
  maxRetries = 2,
  options?: ExecutePlanOptions
): Promise<ExecutionPlan> {
  if (options?.signal?.aborted) {
    return { ...plan, status: 'partial_failed' };
  }
  const updatedPlan: ExecutionPlan = { ...plan, status: 'running' };
  const executed = [...plan.calls];
  const retryCount = new Map<string, number>();

  for (let i = 0; i < executed.length; i++) {
    if (options?.signal?.aborted) {
      updatedPlan.calls = [...executed];
      updatedPlan.status = 'partial_failed';
      onProgress({ ...updatedPlan });
      return updatedPlan;
    }

    if (executed[i].status !== 'pending') continue;

    updatedPlan.calls = [...executed];
    onProgress({ ...updatedPlan });

    const call = executed[i];
    let result: ToolCall;

    if (isNonIdempotentTool(call.tool)) {
      const now = Date.now();
      const toolResult = await executeToolByName(call.tool, call.input);
      result = {
        ...call,
        status: toolResult.success ? 'success' : 'failed',
        result: toolResult,
        error: toolResult.success ? undefined : toolResult.message,
        startedAt: now,
        finishedAt: Date.now(),
      };
    } else {
      result = await executeToolCall(executed[i]);

      if (result.status === 'failed' && maxRetries > 0) {
        let currentRetries = retryCount.get(executed[i].id) || 0;

        while (result.status === 'failed' && currentRetries < maxRetries) {
          currentRetries++;
          retryCount.set(executed[i].id, currentRetries);
          result = await executeToolCall(executed[i]);
        }
      }
    }

    executed[i] = result;
    updatedPlan.calls = [...executed];
    onProgress({ ...updatedPlan });
  }

  const hasFailure = executed.some((c) => c.status === 'failed');
  updatedPlan.status = hasFailure ? 'partial_failed' : 'completed';
  updatedPlan.completedAt = Date.now();
  updatedPlan.calls = [...executed];
  return updatedPlan;
}

export { dataSource } from './apiAdapter';
export { getDataSourceLabel } from './apiAdapter';

export const toolSchemas = [
  {
    type: 'function' as const,
    function: {
      name: 'search_restaurant',
      description:
        '搜索餐厅/美食商家，获取评分、地址、电话、排队情况等实时信息。优先用于餐饮类活动的商家查询。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '餐厅或美食名称，如"海底捞火锅"' },
          city: { type: 'string', description: '所在城市，如"北京"' },
          people: { type: 'number', description: '用餐人数' },
        },
        required: ['name', 'city', 'people'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_availability',
      description: '检查餐厅在指定时间段是否有空位可用',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '餐厅名称' },
          time: { type: 'string', description: '期望时间，如"14:30-16:30"' },
          people: { type: 'number', description: '用餐人数' },
        },
        required: ['name', 'time', 'people'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'make_reservation',
      description: '预订餐厅座位，需要先确认有空位后再调用',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '餐厅名称' },
          time: { type: 'string', description: '预订时间，如"14:30-16:30"' },
          people: { type: 'number', description: '用餐人数' },
          contact: { type: 'string', description: '联系电话，格式如"138****8888"' },
        },
        required: ['name', 'time', 'people', 'contact'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_queue',
      description: '查询餐厅当前排队情况',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '餐厅名称' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'join_queue',
      description: '在线取号排队',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '餐厅名称' },
          people: { type: 'number', description: '用餐人数' },
          contact: { type: 'string', description: '联系电话' },
        },
        required: ['name', 'people', 'contact'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'book_activity',
      description: '预约非餐饮类活动（如景点、展览、体验项目等）',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '活动/景点名称' },
          time: { type: 'string', description: '预约时间，如"14:30-16:30"' },
          people: { type: 'number', description: '参与人数' },
        },
        required: ['name', 'time', 'people'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'order_delivery',
      description:
        '美团同城配送：点外卖、送蛋糕到餐厅、送鲜花到指定地点、代购商品等。支持指定送达时间和地点。在生日、纪念日、聚会场景中主动推荐使用。',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: '配送物品/餐品名称' },
          deliverTo: { type: 'string', description: '配送地址' },
          time: { type: 'string', description: '期望送达时间' },
        },
        required: ['item', 'deliverTo', 'time'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'dispatch_taxi',
      description: '为当前行程段预约车辆或立即叫车，适合多人、老人、儿童同行场景',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '上车点名称' },
          to: { type: 'string', description: '下车点名称' },
          time: { type: 'string', description: '计划出发时间' },
          people: { type: 'number', description: '乘车人数' },
          tierLabel: { type: 'string', description: '车型建议，如舒适型/六座商务' },
          estimatedFare: { type: 'number', description: '预估车费' },
          estimatedWaitMinutes: { type: 'number', description: '预计等待时长' },
        },
        required: ['from', 'to', 'time', 'people'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_route',
      description: '计算多个地点之间的最优出行路线和时间',
      parameters: {
        type: 'object',
        properties: {
          activities: {
            type: 'array',
            items: { type: 'string' },
            description: '按顺序排列的地点名称列表',
          },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lat: { type: 'number', description: '纬度' },
                lng: { type: 'number', description: '经度' },
              },
            },
            description: '对应地点的坐标列表（可选，如未提供则使用估算坐标）',
          },
        },
        required: ['activities'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_hotel',
      description: '搜索酒店住宿，获取评分、地址、价格等实时信息。用于跨天出行需要住宿的场景。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '所在城市，如"北京"' },
          keywords: { type: 'string', description: '酒店关键词，如"五星级酒店"、"商务酒店"' },
          maxPrice: { type: 'number', description: '最高价格限制，单位元' },
          minRating: { type: 'number', description: '最低评分要求，如 4.0' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'book_hotel',
      description: '预订酒店住宿',
      parameters: {
        type: 'object',
        properties: {
          hotelId: { type: 'string', description: '酒店ID' },
          hotelName: { type: 'string', description: '酒店名称' },
          checkIn: { type: 'string', description: '入住时间，如"14:00"' },
          checkOut: { type: 'string', description: '退房时间，如"次日12:00"' },
          peopleCount: { type: 'number', description: '入住人数' },
          contact: { type: 'string', description: '联系电话，格式如"138****8888"' },
        },
        required: ['hotelId', 'hotelName', 'checkIn', 'checkOut', 'peopleCount', 'contact'],
      },
    },
  },
];

export async function executeToolByName(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const toolName = name as ToolName;
  const handler = toolHandlers[toolName];
  if (!handler) {
    return { success: false, message: `未知工具: ${name}` };
  }

  if (isNonIdempotentTool(toolName)) {
    const key = generateIdempotencyKey(toolName, args);
    const now = Date.now();
    const completed = completedNonIdempotentRequests.get(key);
    if (completed && now - completed.timestamp < NON_IDEMPOTENT_RESULT_TTL_MS) {
      console.log(`[Tool] Reusing completed request for: ${toolName}`);
      return completed.result;
    }
    if (completed) completedNonIdempotentRequests.delete(key);

    const pending = pendingRequests.get(key);
    if (pending && pending.status === 'pending' && now - pending.timestamp < 30000) {
      console.log(`[Tool] Reusing pending request for: ${toolName}`);
      return pending.promise;
    }

    const promise = handler(args);
    pendingRequests.set(key, { promise, timestamp: now, status: 'pending' });
    try {
      const result = await promise;
      if (result.success) {
        completedNonIdempotentRequests.set(key, { result, timestamp: Date.now() });
      }
      return result;
    } catch (err) {
      return {
        success: false,
        message: `工具执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
      };
    } finally {
      pendingRequests.delete(key);
    }
  }

  try {
    return await handler(args);
  } catch (err) {
    return {
      success: false,
      message: `工具执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
    };
  }
}
