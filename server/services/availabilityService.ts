/**
 * AvailabilityService — 可用性预检服务
 * 
 * 比赛核心要求：下单前预检座位/票务/时间冲突
 * 当前为 Mock 实现，可替换为真实 API 调用
 */

// ── 类型定义 ──

export interface AvailabilityCheckRequest {
  activityId: string;
  activityTitle: string;
  activityType: 'food' | 'activity' | 'transport';
  timeLine?: string;
  memberCount?: number;
  price?: number;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  failureType?: 'no_seat' | 'no_ticket' | 'time_conflict';
  alternatives?: string[];
  suggestion?: string;
}

// ── Mock 数据 ──

/** 模拟不可用商家列表（用于 Demo 展示） */
const MOCK_UNAVAILABLE: Record<string, { reason: string; failureType: 'no_seat' | 'no_ticket' | 'time_conflict'; alternatives: string[] }> = {
  '故宫': {
    reason: '故宫今日门票已售罄（周末通常提前3天售完），建议选择替代景点',
    failureType: 'no_ticket',
    alternatives: ['天坛公园（¥34，同类型文化景点）', '景山公园（¥2，可俯瞰故宫全景）', '北海公园（¥10，皇家园林风光）'],
  },
  '长城': {
    reason: '八达岭长城今日门票已售罄，建议改日或选择其他长城段',
    failureType: 'no_ticket',
    alternatives: ['慕田峪长城（人少景美）', '居庸关长城（交通便利）', '司马台长城（适合摄影）'],
  },
  '全聚德': {
    reason: '全聚德晚餐时段已满座（18:00-20:00），建议换时段或替代餐厅',
    failureType: 'no_seat',
    alternatives: ['便宜坊烤鸭店（同商圈，步行5分钟）', '大董烤鸭（环境更佳）', '四季民福烤鸭店（性价比高）'],
  },
  '海底捞': {
    reason: '海底捞晚餐高峰期排队超2小时，建议换时段或替代火锅店',
    failureType: 'no_seat',
    alternatives: ['小龙坎火锅（无需排队）', '湊湊火锅（茶饮+火锅）', '左庭右院鲜牛肉火锅'],
  },
  '下午茶': {
    reason: '该时段与前序购物活动时间冲突，无法按时到达',
    failureType: 'time_conflict',
    alternatives: ['调整为15:30-17:00', '替换为附近半小时可达的咖啡店', '取消购物活动腾出时间'],
  },
};

/** 随机模拟不可用（约30%概率触发） */
function randomUnavailable(activityTitle: string): AvailabilityResult | null {
  // Demo 模式：检查已知不可用列表
  for (const [keyword, config] of Object.entries(MOCK_UNAVAILABLE)) {
    if (activityTitle.includes(keyword)) {
      return {
        available: false,
        reason: config.reason,
        failureType: config.failureType,
        alternatives: config.alternatives,
        suggestion: config.failureType === 'no_seat'
          ? '建议更换时段（避开用餐高峰18:00-20:00）或选择附近同类餐厅'
          : config.failureType === 'no_ticket'
            ? '建议提前1天预订门票，或选择工作日出行'
            : '建议压缩前序活动10-15分钟，或调整为弹性时段',
      };
    }
  }

  // 随机触发（约20%概率）
  if (Math.random() < 0.2) {
    const types: Array<{ reason: string; failureType: 'no_seat' | 'no_ticket' | 'time_conflict'; alternatives: string[] }> = [
      {
        reason: '该餐厅当前时段已满座，无法预订',
        failureType: 'no_seat',
        alternatives: [`${activityTitle}附近餐厅A`, `${activityTitle}附近餐厅B`, `${activityTitle}同类型餐厅C`],
      },
      {
        reason: '该景点门票已售罄',
        failureType: 'no_ticket',
        alternatives: [`${activityTitle}替代景点1`, `${activityTitle}替代景点2`, `同区域热门景点`],
      },
      {
        reason: '与前序活动时间冲突，无法按时到达',
        failureType: 'time_conflict',
        alternatives: ['调整为延后30分钟', '替换为附近同类场所', '压缩前序活动腾出时间'],
      },
    ];
    const selected = types[Math.floor(Math.random() * types.length)];
    return {
      available: false,
      ...selected,
    };
  }

  return null; // 可用
}

// ── 预检函数 ──

/**
 * 检查活动可用性（座位/票务/时间冲突）
 */
export function checkAvailability(request: AvailabilityCheckRequest): AvailabilityResult {
  const unavailable = randomUnavailable(request.activityTitle);
  
  if (unavailable) {
    console.log(`[Availability] ❌ ${request.activityTitle}: ${unavailable.reason}`);
    return unavailable;
  }

  console.log(`[Availability] ✅ ${request.activityTitle}: 可用`);
  return { available: true };
}

/**
 * 批量预检多个活动
 */
export function batchCheckAvailability(requests: AvailabilityCheckRequest[]): AvailabilityResult[] {
  return requests.map(req => checkAvailability(req));
}

/**
 * 根据失败类型获取替代方案建议
 */
export function getAlternativesForType(
  activityTitle: string,
  failureType: 'no_seat' | 'no_ticket' | 'time_conflict'
): string[] {
  // 先查已知列表
  for (const [keyword, config] of Object.entries(MOCK_UNAVAILABLE)) {
    if (activityTitle.includes(keyword) && config.failureType === failureType) {
      return config.alternatives;
    }
  }

  // 默认替代建议
  const defaults: Record<string, string[]> = {
    no_seat: ['附近同类餐厅（评分4.5+）', '换个时段（14:00-16:00空闲多）', '外卖到酒店/公园'],
    no_ticket: ['同类型免费景点', '换个日期出行', '选择冷门时段'],
    time_conflict: ['缩短前序活动15分钟', '调整为弹性时段', '替换为附近30分钟可达场所'],
  };

  return defaults[failureType] || [];
}
