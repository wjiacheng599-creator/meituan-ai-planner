import { getFeedImage } from '../imageLibrary';
import { dataSource } from '../apiAdapter';
import { batchFetchPOIImages } from '../poiImageService';
import { ServiceIntent, IntentRule, DetectedIntent } from './types';
import { getUserCity, fetchWeather } from './weather';
import {
  generateRestaurantMockData,
  generateDeliveryMockData,
  generateTicketMockData,
  generateCouponMockData,
} from './mockData';
import {
  formatPoiDistance,
  DEFAULT_POI_RATING,
  DEFAULT_RESTAURANT_COST,
  DEFAULT_ACTIVITY_COST,
  MIN_DISTANCE_KM,
} from './utils';
import { cachedSearchPOI } from './cache';
import { callDashScope } from './core';
import { TOOLS } from './tools';
import { recognizeIntentWithLLM, type LLMIntentResult } from './tools/llmIntentRecognizer';
import type { ServiceIntentResult } from './tools/registry';

/**
 * 从用户自然语言输入中提取结构化需求信息
 * 用于判断是否需要展示需求确认卡片
 *
 * 增强版：语义理解 + 智能推断
 */
export interface ParsedRequirements {
  date?: string;
  days?: number;
  people?: number;
  hasChildren?: boolean;
  hasElderly?: boolean;
  budget?: [number, number];
  preferences?: string[];
  transport?: string; // 新增：交通方式
  duration?: number; // 新增：时长（小时）
  missingFields?: string[]; // 新增：缺失字段列表
  completeness: number; // 0-1 信息完整度
}

export function parseInputForRequirements(query: string): ParsedRequirements {
  const result: ParsedRequirements = { completeness: 0 };
  let filled = 0;
  const total = 8; // date, days, people, special, preferences, budget, transport, duration

  // ── 提取日期 ──
  const dateMatch = query.match(/(今天|明天|后天|周六|周日|周末|下*周[一二三四五六日])/);
  if (dateMatch) {
    result.date = dateMatch[0];
    filled++;
  }

  // ── 提取天数 ──
  const daysMatch = query.match(/(\d+)\s*天|半日|半天|一日|两天一夜/);
  if (daysMatch) {
    if (/半[日天]/.test(daysMatch[0])) result.days = 0.5;
    else if (/一日/.test(daysMatch[0])) result.days = 1;
    else if (/两天一夜/.test(daysMatch[0])) result.days = 2;
    else result.days = parseInt(daysMatch[1]);
    filled++;
  }

  // ── 提取人数 ──
  const peopleMatch = query.match(/(\d+)\s*人|一家(\d+)口|两人|三人|四人/);
  if (peopleMatch) {
    if (/两人/.test(peopleMatch[0])) result.people = 2;
    else if (/三人/.test(peopleMatch[0])) result.people = 3;
    else if (/四人/.test(peopleMatch[0])) result.people = 4;
    else result.people = parseInt(peopleMatch[1] || peopleMatch[2]);
    filled++;
  }

  // ── 检测特殊人群 ──
  result.hasChildren = /带娃|亲子|小孩|孩子|宝宝|小朋友/.test(query);
  result.hasElderly = /老人|长辈|爸妈|父母|父亲|母亲/.test(query);
  if (result.hasChildren || result.hasElderly) filled++;

  // ── 提取偏好（增强语义理解）──
  const prefs: string[] = [];
  if (/美食|吃|火锅|烧烤|日料|餐厅|吃饭/.test(query)) prefs.push('美食');
  if (/拍照|打卡|出片|摄影|好看|网红/.test(query)) prefs.push('拍照');
  if (/自然|风景|山水|公园|散步|户外/.test(query)) prefs.push('自然');
  if (/历史|文化|古迹|博物馆|展览|艺术/.test(query)) prefs.push('文化');
  if (/购物|逛街|商场|买/.test(query)) prefs.push('购物');
  if (/娱乐|电影|KTV|游戏|桌游|密室/.test(query)) prefs.push('娱乐');
  if (/咖啡|下午茶|喝茶|安静|坐坐/.test(query)) prefs.push('咖啡');
  if (/亲子|儿童|游乐|孩子/.test(query)) prefs.push('亲子');
  if (/约会|浪漫|氛围|情侣/.test(query)) prefs.push('约会');
  if (/聚会|朋友|热闹/.test(query)) prefs.push('聚会');
  // 目的地检测
  if (/故宫|颐和园|长城|天坛|北海|圆明园|鸟巢|景山|雍和宫|胡同|前门|三里屯|南锣鼓巷/.test(query))
    prefs.push('景点');
  // 语义推断："随便吃点" → 轻食偏好
  if (/随便|随意|简单|轻松/.test(query)) prefs.push('轻松');
  if (/轻食|沙拉|低卡|减肥|健康/.test(query)) prefs.push('轻食');
  if (prefs.length > 0) {
    result.preferences = prefs;
    filled++;
  }

  // ── 提取预算（增强语义理解）──
  const budgetMatch = query.match(/预算(\d+)[~-](\d+)|人均(\d+)/);
  if (budgetMatch) {
    if (budgetMatch[1] && budgetMatch[2]) {
      result.budget = [parseInt(budgetMatch[1]), parseInt(budgetMatch[2])];
    } else if (budgetMatch[3]) {
      const val = parseInt(budgetMatch[3]);
      result.budget = [val - 50, val + 100];
    }
    filled++;
  } else {
    // 语义推断预算
    if (/别太贵|省钱|经济|便宜|实惠/.test(query)) {
      result.budget = [0, 200];
      filled++;
    } else if (/不限|随便花|高端|奢华|品质/.test(query)) {
      result.budget = [500, 5000];
      filled++;
    }
  }

  // ── 提取交通方式（新增）──
  if (/开车|自驾|驾车/.test(query)) {
    result.transport = 'driving';
    filled++;
  } else if (/地铁|公交|公共交通|坐车/.test(query)) {
    result.transport = 'transit';
    filled++;
  } else if (/步行|走路|散步|溜达/.test(query)) {
    result.transport = 'walking';
    filled++;
  } else if (/打车|叫车|出租/.test(query)) {
    result.transport = 'taxi';
    filled++;
  } else {
    // 语义推断："不远" → 近距离，默认驾车
    if (/不远|附近|周边|家门口|近/.test(query)) {
      result.transport = 'driving';
      filled++;
    }
  }

  // ── 提取时长（新增）──
  const durationMatch = query.match(/(\d+)\s*[个]?[小时h]|半[天日]|一[天整]|全天/);
  if (durationMatch) {
    if (/半[天日]/.test(durationMatch[0])) result.duration = 4;
    else if (/一[天整]/.test(durationMatch[0])) result.duration = 8;
    else if (/全天/.test(durationMatch[0])) result.duration = 10;
    else result.duration = parseInt(durationMatch[1]);
    filled++;
  } else {
    // 语义推断："玩几个小时" → 4-6h
    if (/几个小时|一会儿|随便逛逛|透透气/.test(query)) {
      result.duration = 4;
      filled++;
    } else if (/深度|满满|充实|一整天/.test(query)) {
      result.duration = 8;
      filled++;
    }
  }

  // ── 计算缺失字段 ──
  const missing: string[] = [];
  if (!result.date) missing.push('date');
  if (!result.people) missing.push('people');
  if (!result.budget) missing.push('budget');
  if (!result.transport) missing.push('transport');
  if (!result.duration && !result.days) missing.push('duration');
  if (!result.preferences || result.preferences.length === 0) missing.push('preferences');
  result.missingFields = missing;

  result.completeness = filled / total;
  return result;
}

const weightedIntentRules: IntentRule[] = [
  {
    type: 'weather',
    keywords: [
      { word: '天气', weight: 1.0 },
      { word: '下雨', weight: 0.9 },
      { word: '气温', weight: 0.9 },
      { word: '温度', weight: 0.8 },
      { word: '冷不冷', weight: 0.9 },
      { word: '热不热', weight: 0.9 },
      { word: '穿什么', weight: 0.7 },
      { word: '带伞', weight: 0.8 },
      { word: '会不会下', weight: 0.7 },
    ],
  },
  {
    type: 'delivery',
    keywords: [
      { word: '外卖', weight: 1.0 },
      { word: '送餐', weight: 0.9 },
      { word: '配送', weight: 0.8 },
      { word: '送到家', weight: 0.9 },
      { word: '点餐', weight: 0.8 },
      { word: '饿了', weight: 0.9 },
      { word: '不想出门', weight: 0.8 },
      { word: '奶茶', weight: 1.0 },
      { word: '点杯', weight: 1.0 },
      { word: '叫杯', weight: 1.0 },
      { word: '来杯', weight: 1.0 },
      { word: '奶茶店', weight: 0.9 },
      { word: '咖啡', weight: 1.0 },
      { word: '咖啡店', weight: 0.8 },
      { word: '饮料', weight: 0.8 },
      { word: '甜品', weight: 0.8 },
      { word: '汉堡', weight: 0.9 },
      { word: '炸鸡', weight: 0.9 },
      { word: '披萨', weight: 0.9 },
      { word: '快餐', weight: 0.9 },
      { word: '小吃', weight: 0.7 },
      { word: '点个', weight: 0.9 },
      { word: '叫个', weight: 0.9 },
      { word: '来点', weight: 0.9 },
      { word: '点一份', weight: 0.9 },
      { word: '叫一份', weight: 0.9 },
      { word: '来一份', weight: 0.9 },
      { word: '想喝', weight: 0.9 },
      { word: '想吃', weight: 0.9 },
      { word: '喝点', weight: 0.9 },
      { word: '吃点', weight: 0.9 },
    ],
  },
  {
    type: 'ticket',
    keywords: [
      { word: '电影', weight: 1.0 },
      { word: '票', weight: 0.6 },
      { word: '演出', weight: 0.9 },
      { word: '展览', weight: 0.8 },
      { word: '门票', weight: 0.9 },
      { word: '买票', weight: 0.9 },
      { word: '看什么', weight: 0.7 },
      { word: '话剧', weight: 0.9 },
      { word: '演唱会', weight: 1.0 },
      { word: '景区', weight: 0.8 },
    ],
  },
  {
    type: 'coupon',
    keywords: [
      { word: '优惠', weight: 1.0 },
      { word: '券', weight: 0.7 },
      { word: '打折', weight: 0.9 },
      { word: '满减', weight: 1.0 },
      { word: '折扣', weight: 0.9 },
      { word: '红包', weight: 0.8 },
      { word: '省钱', weight: 0.8 },
      { word: '便宜', weight: 0.6 },
    ],
  },
  {
    type: 'restaurant',
    keywords: [
      { word: '餐厅', weight: 1.0 },
      { word: '吃饭', weight: 0.9 },
      { word: '好吃的', weight: 0.8 },
      { word: '美食', weight: 0.8 },
      { word: '火锅', weight: 0.9 },
      { word: '烧烤', weight: 0.9 },
      { word: '日料', weight: 0.9 },
      { word: '西餐', weight: 0.8 },
      { word: '小吃', weight: 0.7 },
      { word: '聚餐', weight: 0.9 },
      { word: '去哪吃', weight: 1.0 },
      { word: '咖啡', weight: 0.7 },
      { word: '咖啡馆', weight: 0.8 },
      { word: '下午茶', weight: 0.9 },
      { word: '甜品', weight: 0.8 },
      { word: '喝杯咖啡', weight: 0.9 },
    ],
  },
  {
    type: 'compare',
    keywords: [
      { word: '对比', weight: 1.0 },
      { word: '哪个好', weight: 0.9 },
      { word: '比较', weight: 0.7 },
      { word: '选哪个', weight: 1.0 },
      { word: '哪个更', weight: 0.9 },
    ],
  },
  {
    type: 'plan',
    keywords: [
      { word: '规划', weight: 1.0 },
      { word: '行程', weight: 0.9 },
      { word: '安排', weight: 0.8 },
      { word: '计划', weight: 0.8 },
      { word: '去哪', weight: 0.7 },
      { word: '一日游', weight: 1.0 },
      { word: '半日', weight: 0.9 },
      { word: '出游', weight: 0.9 },
      { word: '约会', weight: 0.8 },
      { word: '亲子', weight: 0.9 },
      { word: '闺蜜', weight: 0.8 },
      { word: 'citywalk', weight: 1.0 },
      { word: '散步', weight: 0.7 },
      { word: '放松', weight: 0.7 },
      { word: '出去玩', weight: 1.0 },
      { word: '想玩', weight: 0.9 },
      { word: '无聊', weight: 0.8 },
      { word: '周末', weight: 0.8 },
      { word: '逛逛', weight: 0.8 },
      { word: '溜达', weight: 0.7 },
      { word: '转转', weight: 0.7 },
      { word: '走走', weight: 0.7 },
    ],
  },
];

function detectMultiIntents(query: string): DetectedIntent[] {
  const q = query.toLowerCase();
  const results: DetectedIntent[] = [];

  for (const rule of weightedIntentRules) {
    let totalWeight = 0;
    const matchedWords: string[] = [];

    for (const { word, weight } of rule.keywords) {
      if (new RegExp(word, 'i').test(q)) {
        totalWeight += weight;
        matchedWords.push(word);
      }
    }

    if (matchedWords.length > 0 && totalWeight > 0.5) {
      results.push({ type: rule.type, confidence: totalWeight, matchedWords });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

export function detectIntent(query: string): ServiceIntent {
  const q = query.toLowerCase();

  // 快速规则：优先匹配明确的配送意图
  const deliveryPatterns = [
    /外卖|送餐|配送|送到家|点餐|饿了|不想出门/i,
    /奶茶|点杯|叫杯|来杯|点个|叫个|来点|奶茶店|饮料|汉堡|炸鸡|披萨|快餐/i,
  ];

  const hasDeliveryVerb = deliveryPatterns.some((p) => p.test(q));
  const hasDeliveryContext = /(奶茶|咖啡|饮料|甜品)/i.test(q) && /(点|叫|来|想吃|要)/i.test(q);

  // 如果有明确的配送意图或配送上下文，优先识别为delivery
  if (hasDeliveryVerb || hasDeliveryContext) {
    return { type: 'delivery' as const, keywords: query };
  }

  const multiIntents = detectMultiIntents(query);

  if (multiIntents.length === 0) {
    return { type: 'chat', query };
  }

  const topIntent = multiIntents[0];

  if (topIntent.type === 'plan') {
    return { type: 'plan' as const, query };
  }

  if (topIntent.type === 'compare') {
    return { type: 'compare' as const, query };
  }

  if (topIntent.type === 'weather') {
    return { type: 'weather' as const };
  }

  if (topIntent.type === 'restaurant') {
    return { type: 'restaurant' as const, keywords: query };
  }
  if (topIntent.type === 'delivery') {
    return { type: 'delivery' as const, keywords: query };
  }
  if (topIntent.type === 'ticket') {
    return { type: 'ticket' as const, keywords: query };
  }
  if (topIntent.type === 'coupon') {
    return { type: 'coupon' as const, keywords: query };
  }

  return { type: 'chat' as const, query };
}

export async function handleMultiIntents(
  intents: DetectedIntent[],
  city: string
): Promise<Array<{ type: ServiceIntent['type']; result: unknown }>> {
  const results: Array<{ type: ServiceIntent['type']; result: unknown }> = [];

  for (const intent of intents.slice(0, 3)) {
    let intentObj: ServiceIntent;
    if (intent.type === 'weather') {
      intentObj = { type: 'weather', city };
    } else if (intent.type === 'restaurant') {
      intentObj = { type: 'restaurant', keywords: city };
    } else if (intent.type === 'delivery') {
      intentObj = { type: 'delivery', keywords: city };
    } else if (intent.type === 'ticket') {
      intentObj = { type: 'ticket', keywords: city };
    } else if (intent.type === 'coupon') {
      intentObj = { type: 'coupon', keywords: city };
    } else {
      intentObj = { type: 'chat', query: city };
    }
    const result = await handleServiceIntent(intentObj);
    results.push({ type: intent.type, result });
  }

  return results;
}

export async function handleServiceIntent(intent: ServiceIntent): Promise<{
  text: string;
  cardType?: string;
  cardData?: unknown;
}> {
  const city = await getUserCity();

  switch (intent.type) {
    case 'weather': {
      const w = await fetchWeather(intent.city || city);
      return {
        text: `${w.city}现在${w.condition}，${w.temp}°C，${w.advice}`,
        cardType: 'weather',
        cardData: {
          city: w.city,
          temp: w.temp,
          condition: w.condition,
          humidity: w.humidity,
          wind: '微风',
          high: parseInt(w.tempRange.split('~')[1]) || w.temp + 3,
          low: parseInt(w.tempRange.split('~')[0]) || w.temp - 3,
          advice: w.advice,
        },
      };
    }

    case 'restaurant': {
      const remote = await cachedSearchPOI(intent.keywords || '餐厅', city);
      let results;
      let dataSourceLabel = '高德推荐';
      if (remote.length > 0) {
        const sliced = remote.slice(0, 6);
        const imageMap = await batchFetchPOIImages(
          sliced.map((poi) => ({ name: poi.name, city, poiId: poi.id || undefined }))
        );
        results = sliced.map((poi, index) => ({
          id: `r_amap_${index}`,
          name: poi.name,
          rating: parseFloat(poi.rating || '0') || 0,
          avgPrice: Number(poi.cost) > 0 ? Number(poi.cost) : DEFAULT_RESTAURANT_COST,
          distance: poi.distance
            ? `${Math.max(MIN_DISTANCE_KM, Number(poi.distance) / 1000).toFixed(1)}km`
            : '附近',
          category: poi.type?.split(';')[0] || '餐厅',
          tags: [poi.type?.split(';')[1] || '美食', '高德推荐'],
          address: poi.address || city,
          image:
            imageMap.get(poi.name) ||
            getFeedImage(`${poi.name} ${poi.type} ${city}`, `restaurant_live_${index}`),
          poiId: poi.id || undefined,
          openTime: poi.openTime,
          businessArea: poi.businessArea,
          phone: poi.phone && poi.phone !== '暂无' ? poi.phone : undefined,
        }));
      } else {
        // 用 AI 生成推荐替代 mockData
        try {
          const aiPrompt = `你是${city}本地生活专家。用户想找"${intent.keywords || '餐厅'}"。
推荐 6 家真实的、口碑好的餐厅/咖啡馆。
返回 JSON 数组，每个元素：{"name":"店名","category":"类别","avgPrice":人均价格数字,"tags":["标签1","标签2"]}
注意：必须是${city}真实存在的店，不要虚构。`;
          const aiResult = await callDashScope(
            aiPrompt,
            `推荐${city}的${intent.keywords || '餐厅'}`,
            true
          );
          const parsed = JSON.parse(aiResult);
          if (Array.isArray(parsed) && parsed.length > 0) {
            results = parsed.slice(0, 6).map((item: Record<string, unknown>, index: number) => ({
              id: `r_ai_${index}`,
              name: String(item.name || '推荐餐厅'),
              rating: 4.5 + Math.random() * 0.4,
              avgPrice: Number(item.avgPrice) || DEFAULT_RESTAURANT_COST,
              distance: `${(2 + Math.random() * 5).toFixed(1)}km`,
              category: String(item.category || '餐厅'),
              tags: Array.isArray(item.tags) ? ['AI推荐', ...item.tags.slice(0, 2)] : ['AI推荐'],
              address: city,
              image: getFeedImage(
                `${item.name} ${item.category} ${city}`,
                `restaurant_ai_${index}`
              ),
            }));
            dataSourceLabel = 'AI推荐';
          } else {
            results = generateRestaurantMockData(intent.keywords || '餐厅', city);
            dataSourceLabel = '示例数据';
          }
        } catch {
          results = generateRestaurantMockData(intent.keywords || '餐厅', city);
          dataSourceLabel = '示例数据';
        }
      }
      return {
        text: /咖啡|下午茶|甜品/.test(intent.keywords || '')
          ? `为你找到了 ${results.length} 家安静又适合坐坐的咖啡馆${dataSourceLabel === 'AI推荐' ? '（基于AI推荐）' : ''}，横滑看看`
          : `为你找到了 ${results.length} 家附近的优质餐厅${dataSourceLabel === 'AI推荐' ? '（基于AI推荐）' : ''}，横滑查看更多`,
        cardType: 'restaurant',
        cardData: results,
      };
    }

    case 'delivery': {
      const remote = await cachedSearchPOI(intent.keywords || '外卖 餐饮', city, 5000, '餐饮服务');
      let results;
      if (remote.length > 0) {
        const sliced = remote.slice(0, 6);
        const imageMap = await batchFetchPOIImages(
          sliced.map((poi) => ({ name: poi.name, city, poiId: poi.id || undefined }))
        );
        results = sliced.map((poi, index) => ({
          id: `d_amap_${index}`,
          name: poi.name,
          category: poi.type?.split(';')[0] || '外卖',
          rating: parseFloat(poi.rating || '0') || 0,
          deliveryTime: poi.openTime ? '营业中' : '约30分钟',
          deliveryFee: Number(poi.cost) > 0 ? Math.max(3, Math.round(Number(poi.cost) / 30)) : 5,
          avgPrice: Number(poi.cost) > 0 ? Number(poi.cost) : DEFAULT_RESTAURANT_COST,
          tags: [poi.type?.split(';')[1] || '餐饮', '附近优先'],
          image:
            imageMap.get(poi.name) ||
            getFeedImage(`${poi.name} ${poi.type} ${city}`, `delivery_live_${index}`),
          poiId: poi.id || undefined,
          address: poi.address,
          businessArea: poi.businessArea,
          phone: poi.phone && poi.phone !== '暂无' ? poi.phone : undefined,
        }));
      } else {
        results = generateDeliveryMockData(intent.keywords || '外卖', city);
      }
      return {
        text: `为你推荐 ${results.length} 家高分外卖，30分钟内可送达`,
        cardType: 'delivery',
        cardData: results,
      };
    }

    case 'ticket': {
      const remote = await cachedSearchPOI(
        intent.keywords || '活动 展览',
        city,
        5000,
        '体育休闲服务'
      );
      let results;
      if (remote.length > 0) {
        const sliced = remote.slice(0, 4);
        const imageMap = await batchFetchPOIImages(
          sliced.map((poi) => ({
            name: poi.name,
            city,
            location: poi.id ? undefined : undefined,
            poiId: poi.id,
          }))
        );
        results = sliced.map((poi, index) => ({
          id: `t_amap_${index}`,
          name: poi.name,
          venue: poi.businessArea || poi.address || city,
          date: poi.openTime ? '营业中' : '全天',
          time: poi.openTime || '详询场馆',
          price: Number(poi.cost) > 0 ? Number(poi.cost) : 0,
          rating: parseFloat(poi.rating || DEFAULT_POI_RATING),
          tags: [poi.type?.split(';')[0] || '活动', '高德推荐'],
          image:
            imageMap.get(poi.name) ||
            getFeedImage(`${poi.name} ${poi.type} ${city}`, `ticket_live_${index}`),
          poiId: poi.id,
          openTime: poi.openTime,
          address: poi.address,
          type: poi.type,
        }));
      } else {
        // 用 AI 生成推荐替代 mockData
        try {
          const aiPrompt = `你是${city}本地活动专家。用户想找"${intent.keywords || '活动展览'}"。
推荐 4 个真实的、近期可去的活动/展览/演出。
返回 JSON 数组，每个元素：{"name":"活动名","venue":"地点","date":"日期","time":"时间","price":价格数字,"tags":["标签1"]}`;
          const aiResult = await callDashScope(
            aiPrompt,
            `推荐${city}的${intent.keywords || '活动展览'}`,
            true
          );
          const parsed = JSON.parse(aiResult);
          if (Array.isArray(parsed) && parsed.length > 0) {
            results = parsed.slice(0, 4).map((item: Record<string, unknown>, index: number) => ({
              id: `t_ai_${index}`,
              name: String(item.name || '精彩活动'),
              venue: String(item.venue || city),
              date: String(item.date || '近期'),
              time: String(item.time || '详询场馆'),
              price: Number(item.price) || DEFAULT_ACTIVITY_COST,
              rating: 4.3 + Math.random() * 0.5,
              tags: Array.isArray(item.tags) ? ['AI推荐', ...item.tags.slice(0, 2)] : ['AI推荐'],
              image: getFeedImage(`${item.name} 活动 ${city}`, `ticket_ai_${index}`),
            }));
          } else {
            results = generateTicketMockData(intent.keywords || '票务', city);
          }
        } catch {
          results = generateTicketMockData(intent.keywords || '票务', city);
        }
      }
      return {
        text: `为你推荐 ${results.length} 个热门票务活动`,
        cardType: 'ticket',
        cardData: results,
      };
    }

    case 'coupon': {
      // [PERF-OPT] Use cached search for POI deduplication
      const remote = await cachedSearchPOI('超市 便利店 购物', city, 5000, '购物服务');
      const results =
        remote.length > 0
          ? remote.slice(0, 4).map((poi, index) => ({
              id: `c_amap_${index}`,
              shopName: poi.name,
              discount: `¥${8 + index * 5}`,
              condition: `满${50 + index * 20}可用`,
              validUntil: '7天内有效',
              category: poi.type.split(';')[0] || '通用',
            }))
          : generateCouponMockData(city);
      return {
        text: `为你找到 ${results.length} 张附近可用优惠券，最高可省 30 元`,
        cardType: 'coupon',
        cardData: results,
      };
    }

    case 'plan':
      return { text: '' };

    case 'compare':
      return { text: '' };

    default:
      return { text: '' };
  }
}

export interface HybridIntentResult {
  intent: ServiceIntent;
  source: 'rule' | 'llm' | 'fallback';
  toolHandler?: () => Promise<ServiceIntentResult>;
}

export async function detectIntentHybrid(text: string): Promise<HybridIntentResult> {
  const startTime = Date.now();

  // 1. 先进行快速规则匹配（兼容现有逻辑）
  const ruleResult = detectIntent(text);

  // 判断规则匹配的置信度（从detectMultiIntents获取）
  const multiIntents = detectMultiIntents(text);
  const hasHighConfidenceRule = multiIntents.length > 0 && multiIntents[0].confidence >= 0.8;

  // 快速匹配成功，直接返回
  if (hasHighConfidenceRule && ruleResult.type !== 'chat') {
    console.log(`[Intent] 快速规则匹配: ${ruleResult.type} (${Date.now() - startTime}ms)`);

    // 找到对应的工具handler
    const matchingTool = findMatchingTool(ruleResult);
    if (matchingTool) {
      return {
        intent: ruleResult,
        source: 'rule',
        toolHandler: () => handleServiceIntent(ruleResult),
      };
    }
    return { intent: ruleResult, source: 'rule' };
  }

  // 2. 规则匹配不够，尝试 LLM 识别
  console.log(`[Intent] 启动 LLM 识别 (${Date.now() - startTime}ms)`);

  try {
    const city = await getUserCity();
    const llmResult = await recognizeIntentWithLLM(text, TOOLS, { city });

    if (llmResult.shouldUseTool && llmResult.toolName && llmResult.confidence >= 0.6) {
      const tool = TOOLS.find((t) => t.name === llmResult.toolName);
      if (tool) {
        console.log(`[Intent] LLM 匹配: ${tool.name} (置信度: ${llmResult.confidence.toFixed(2)})`);

        return {
          intent: convertToolToIntent(tool.name, llmResult.toolArgs!),
          source: 'llm',
          toolHandler: () => tool.handler(llmResult.toolArgs!),
        };
      }
    }
  } catch (error) {
    console.warn('[Intent] LLM 识别异常:', error);
  }

  // 3. 兜底回退（如果规则匹配到非chat，仍使用规则）
  if (ruleResult.type !== 'chat') {
    console.log(`[Intent] 使用规则匹配（兜底）: ${ruleResult.type}`);
    return { intent: ruleResult, source: 'fallback' };
  }

  return { intent: { type: 'chat', query: text }, source: 'fallback' };
}

function findMatchingTool(intent: ServiceIntent) {
  const toolMap: Record<ServiceIntent['type'], string> = {
    weather: 'search_weather',
    restaurant: 'search_restaurant',
    delivery: 'search_delivery',
    ticket: 'search_ticket',
    coupon: 'search_coupon',
    plan: 'plan_trip',
    compare: 'compare_options',
    chat: 'chat',
  };
  return TOOLS.find((t) => t.name === toolMap[intent.type]);
}

function convertToolToIntent(toolName: string, args: Record<string, unknown>): ServiceIntent {
  switch (toolName) {
    case 'search_weather':
      return { type: 'weather', city: args.city as string };
    case 'search_restaurant':
      return { type: 'restaurant', keywords: args.keywords as string };
    case 'search_delivery':
      return { type: 'delivery', keywords: args.keywords as string };
    case 'search_ticket':
      return { type: 'ticket', keywords: args.keywords as string };
    case 'search_coupon':
      return { type: 'coupon' };
    case 'plan_trip':
      return { type: 'plan', query: args.query as string };
    case 'compare_options':
      return { type: 'compare', query: args.query as string };
    default:
      return { type: 'chat', query: '' };
  }
}

export interface OrderItem {
  name: string;
  quantity: number;
  specifications: Array<{ key: string; value: string }>;
  exclusions: string[];
}

export interface MultiItemQuery {
  items: OrderItem[];
  totalQuantity: number;
  urgency?: 'normal' | 'urgent' | 'very_urgent';
  budget?: [number, number];
}

/**
 * 解析多商品需求（如："3杯奶茶，一杯去冰一杯少糖一杯正常"）
 * 返回结构化订单数据
 */
export function parseMultiItemQuery(query: string): MultiItemQuery | null {
  const q = query.trim();
  if (!q) return null;

  const items: OrderItem[] = [];

  // 1. 提取商品数量模式："3杯奶茶"、"2个汉堡"、"1份炸鸡"
  const itemPatterns = [
    /(\d+)\s*(杯|个|份|碗|盘|袋|盒|瓶|罐)/g,
    /(一|二|三|四|五|六|七|八|九|十)\s*(杯|个|份|碗|盘|袋|盒|瓶|罐)/g,
  ];

  // 中文数字映射
  const chineseNumMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };

  // 2. 提取商品名 + 数量："奶茶3杯"、"汉堡2个"
  const reversePattern = /([\u4e00-\u9fa5a-zA-Z]+)(\d+)\s*(杯|个|份|碗|盘|袋|盒|瓶|罐)/g;
  let match: RegExpExecArray | null;
  let hasItems = false;

  while ((match = reversePattern.exec(q)) !== null) {
    const name = match[1];
    const qty = parseInt(match[2]);
    items.push({
      name,
      quantity: qty,
      specifications: [],
      exclusions: [],
    });
    hasItems = true;
  }

  // 3. 如果没有匹配到，尝试 "3杯奶茶" 模式
  if (!hasItems) {
    const forwardPattern = /(\d+)\s*(杯|个|份|碗|盘|袋|盒|瓶|罐)\s*([\u4e00-\u9fa5a-zA-Z]+)/g;
    while ((match = forwardPattern.exec(q)) !== null) {
      const qty = parseInt(match[1]);
      const name = match[3];
      items.push({
        name,
        quantity: qty,
        specifications: [],
        exclusions: [],
      });
      hasItems = true;
    }
  }

  // 4. 解析规格："去冰"、"少糖"、"大杯"、"辣"
  const specKeywords = [
    '去冰',
    '少冰',
    '正常冰',
    '多冰',
    '温',
    '热',
    '常温',
    '少糖',
    '半糖',
    '全糖',
    '无糖',
    '三分糖',
    '五分糖',
    '七分糖',
    '大杯',
    '中杯',
    '小杯',
    '大份',
    '中份',
    '小份',
    '加量',
    '加倍',
  ];

  // 将查询按"。"、"，"、"、"分隔，逐个商品分配规格
  const parts = q.split(/[，,。、]/).filter((p) => p.trim().length > 0);

  if (items.length > 0 && parts.length > 1) {
    // 尝试将规格分配到各个商品
    for (let i = 0; i < items.length && i < parts.length; i++) {
      const part = parts[i];
      for (const spec of specKeywords) {
        if (part.includes(spec)) {
          items[i].specifications = items[i].specifications || [];
          items[i].specifications!.push({
            key: spec.includes('冰') ? '冰量' : spec.includes('糖') ? '甜度' : '规格',
            value: spec,
          });
        }
      }
    }
  }

  // 5. 解析排除项："不要辣"、"去香菜"、"不要葱"
  const exclusionPattern = /不要([\u4e00-\u9fa5]+)|去([\u4e00-\u9fa5]+)|不加([\u4e00-\u9fa5]+)/g;
  const exclusions: string[] = [];
  while ((match = exclusionPattern.exec(q)) !== null) {
    const excluded = match[1] || match[2] || match[3];
    if (excluded) exclusions.push(excluded);
  }

  // 如果有排除项，分配到所有商品
  if (exclusions.length > 0 && items.length > 0) {
    for (const item of items) {
      item.exclusions = [...exclusions];
    }
  }

  // 6. 解析紧急程度
  let urgency: 'normal' | 'urgent' | 'very_urgent' = 'normal';
  if (/马上|立刻|快点|着急|饿了/.test(q)) urgency = 'very_urgent';
  else if (/尽快|早点|快点/.test(q)) urgency = 'urgent';

  // 7. 解析预算
  let budget: [number, number] | undefined;
  const budgetMatch = q.match(/预算(\d+)[~-](\d+)|人均(\d+)/);
  if (budgetMatch) {
    if (budgetMatch[1] && budgetMatch[2]) {
      budget = [parseInt(budgetMatch[1]), parseInt(budgetMatch[2])];
    } else if (budgetMatch[3]) {
      const val = parseInt(budgetMatch[3]);
      budget = [val - 50, val + 100];
    }
  }

  if (items.length === 0 && exclusions.length === 0 && urgency === 'normal' && !budget) {
    return null; // 没有解析到任何结构化信息
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: items.length > 0 ? items : [],
    totalQuantity,
    urgency,
    budget,
  };
}

/**
 * 解析规格修改（如："大份改小份"、"去冰改成少冰"）
 */
export function parseSpecificationChange(query: string): {
  itemName?: string;
  changes: Array<{ from: string; to: string }>;
} | null {
  const q = query.trim();

  // 模式："X改Y"、"把X改成Y"、"X换成Y"
  const changePatterns = [
    /(\w+)\s*改\s*(\w+)/,
    /把\s*(\w+)\s*改成\s*(\w+)/,
    /(\w+)\s*换成\s*(\w+)/,
    /不要\s*(\w+)\s*要\s*(\w+)/,
  ];

  for (const pattern of changePatterns) {
    const match = q.match(pattern);
    if (match) {
      // 尝试提取商品名
      const itemMatch = q.match(/([\u4e00-\u9fa5a-zA-Z]+).*改/);
      return {
        itemName: itemMatch ? itemMatch[1] : undefined,
        changes: [{ from: match[1], to: match[2] }],
      };
    }
  }

  return null;
}

/**
 * 解析排除式需求（如："不要辣的要清淡的"）
 */
export function parseExclusionQuery(query: string): {
  exclusions: string[];
  preferences: string[];
} | null {
  const q = query.trim();
  const exclusions: string[] = [];
  const preferences: string[] = [];

  // 排除模式："不要X"、"去X"、"不加X"
  const exclusionPattern = /不要([\u4e00-\u9fa5]+?)[的的，,。\s]|$/g;
  let match: RegExpExecArray | null;

  // 重置 lastIndex
  exclusionPattern.lastIndex = 0;

  while ((match = exclusionPattern.exec(q)) !== null) {
    if (match[1]) exclusions.push(match[1]);
  }

  // 也匹配"去X"、"不加X"
  const otherExclude = /去([\u4e00-\u9fa5]+)|不加([\u4e00-\u9fa5]+)/g;
  while ((match = otherExclude.exec(q)) !== null) {
    const excluded = match[1] || match[2];
    if (excluded && !exclusions.includes(excluded)) {
      exclusions.push(excluded);
    }
  }

  // 偏好模式："要X的"、"选X的"
  const prefPattern = /要([\u4e00-\u9fa5]+)的|选([\u4e00-\u9fa5]+)的/g;
  while ((match = prefPattern.exec(q)) !== null) {
    const pref = match[1] || match[2];
    if (pref) preferences.push(pref);
  }

  if (exclusions.length === 0 && preferences.length === 0) {
    return null;
  }

  return { exclusions, preferences };
}

/**
 * 增强版意图检测：先尝试解析多商品需求，再决定意图类型
 */
export function detectIntentEnhanced(query: string): ServiceIntent {
  const q = query.toLowerCase();

  // 1. 先尝试多商品解析
  const multiItem = parseMultiItemQuery(query);
  if (multiItem && multiItem.items.length > 0) {
    // 判断是外卖还是餐厅
    const isDelivery =
      /(外卖|送餐|配送|送到家|点餐|饿了|不想出门|点杯|叫杯|来杯|点个|叫个|来点)/i.test(q);
    if (isDelivery) {
      return { type: 'delivery', keywords: query, orderItems: multiItem };
    }
  }

  // 2. 尝试规格修改解析
  const specChange = parseSpecificationChange(query);
  if (specChange) {
    // 规格修改通常是对已选商品的修改，归为 delivery 或 restaurant
    const isDelivery = /(外卖|配送|送到)/i.test(q);
    return {
      type: isDelivery ? 'delivery' : 'restaurant',
      keywords: query,
    };
  }

  // 3. 尝试排除式需求解析
  const exclusion = parseExclusionQuery(query);
  if (exclusion) {
    // 排除式需求通常是修改已有订单/推荐，归为 chat（让 AI 处理）
    return { type: 'chat', query };
  }

  // 4. 兜底：使用原有 detectIntent
  return detectIntent(query);
}

// ── 时间紧迫度识别 ──

export interface TimeUrgency {
  urgent: boolean;
  level: 'immediate' | 'soon' | 'relaxed';
  hint: string;
}

export function parseTimeUrgency(query: string): TimeUrgency {
  const q = query.toLowerCase();
  if (/马上|立刻|现在就去|等不及|赶时间|来不及|急着|快点|赶紧/.test(q)) {
    return {
      urgent: true,
      level: 'immediate',
      hint: '用户非常着急，建议缩短行程至1-2小时，精简活动',
    };
  }
  if (/还有.*小时|一小时后|半小时后|马上要|快到了/.test(q)) {
    return { urgent: true, level: 'soon', hint: '用户时间有限，建议控制在3小时内' };
  }
  return { urgent: false, level: 'relaxed', hint: '' };
}

// ── 隐式预算识别 ──

export interface ImplicitBudget {
  detected: boolean;
  level: 'budget' | 'mid' | 'premium';
  hint: string;
}

export function parseImplicitBudget(query: string): ImplicitBudget {
  if (/穷游|省钱|学生|便宜|实惠|性价比|经济|不贵|乞丐版/.test(query)) {
    return { detected: true, level: 'budget', hint: '预算有限，优先推荐性价比高的选择' };
  }
  if (/不差钱|奢华|高端|顶级|最好的|任性|随便花/.test(query)) {
    return { detected: true, level: 'premium', hint: '预算充裕，可以推荐高端体验' };
  }
  if (/中等|普通|一般|平常/.test(query)) {
    return { detected: true, level: 'mid', hint: '中等预算' };
  }
  return { detected: false, level: 'mid', hint: '' };
}
