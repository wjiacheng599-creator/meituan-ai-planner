import { ToolDefinition } from './registry';
import { handleServiceIntent } from '../intent';
import { getUserCity } from '../weather';
import { executeToolByName, type ToolResult } from '../../tools';
import { getFailureAlternatives } from '../../preCheck';
import type { Activity } from '../types';

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_weather',
    description: '查询当前城市的天气信息，包括温度、天气状况、出行建议',
    parameters: [
      {
        name: 'city',
        type: 'string',
        description: '城市名称，可选，不填则使用用户当前位置',
        required: false,
      },
    ],
    handler: async (args) => {
      const city = (args.city as string) || (await getUserCity());
      const result = await handleServiceIntent({ type: 'weather', city });
      return result;
    },
  },
  {
    name: 'search_restaurant',
    description: '查找餐厅、美食，支持关键词搜索（如"川菜"、"火锅店"）',
    parameters: [
      {
        name: 'keywords',
        type: 'string',
        description: '搜索关键词，如"火锅"、"日料"、"附近好吃的"',
        required: true,
      },
    ],
    handler: async (args) => {
      const keywords = args.keywords as string;
      const result = await handleServiceIntent({
        type: 'restaurant',
        keywords,
      });
      return result;
    },
  },
  {
    name: 'search_delivery',
    description: '查找外卖、送餐服务，包括奶茶、咖啡、小吃、汉堡、披萨等',
    parameters: [
      {
        name: 'keywords',
        type: 'string',
        description: '搜索关键词，如"奶茶"、"咖啡"、"汉堡"、"想喝点什么"',
        required: true,
      },
    ],
    handler: async (args) => {
      const keywords = args.keywords as string;
      const result = await handleServiceIntent({
        type: 'delivery',
        keywords,
      });
      return result;
    },
  },
  {
    name: 'search_ticket',
    description: '查找票务信息，如电影票、演出票、景点门票',
    parameters: [
      {
        name: 'keywords',
        type: 'string',
        description: '搜索关键词，如"最近电影"、"演唱会"',
        required: false,
      },
    ],
    handler: async (args) => {
      const keywords = (args.keywords as string) || '活动';
      const result = await handleServiceIntent({
        type: 'ticket',
        keywords,
      });
      return result;
    },
  },
  {
    name: 'search_coupon',
    description: '查找优惠券、折扣信息',
    parameters: [],
    handler: async () => {
      const result = await handleServiceIntent({ type: 'coupon' });
      return result;
    },
  },
  {
    name: 'plan_trip',
    description: '规划出行路线、行程安排',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: '行程规划需求描述',
        required: true,
      },
    ],
    handler: async (args) => {
      return {
        text: '好的，我来帮你规划行程',
        cardType: 'plan_trigger',
        cardData: { query: args.query },
      };
    },
  },
  {
    name: 'compare_options',
    description: '对比多个选项、商家',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: '对比的内容，如"A和B哪个好"',
        required: true,
      },
    ],
    handler: async (args) => {
      return {
        text: '好的，我来帮你对比分析',
        cardType: 'compare_trigger',
        cardData: { query: args.query },
      };
    },
  },
  {
    name: 'check_availability',
    description: '检查座位/票务可用性，支持无座/无票/时间冲突检测',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '商家或活动名称',
        required: true,
      },
      {
        name: 'time',
        type: 'string',
        description: '期望时间段，如"14:30-16:30"',
        required: true,
      },
      {
        name: 'people',
        type: 'number',
        description: '人数',
        required: false,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('check_availability', args);
      return { text: result.message };
    },
  },
  {
    name: 'make_reservation',
    description: '预订餐厅座位，需要先调用check_availability确认有空位',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '餐厅名称',
        required: true,
      },
      {
        name: 'time',
        type: 'string',
        description: '预订时间',
        required: true,
      },
      {
        name: 'people',
        type: 'number',
        description: '用餐人数',
        required: true,
      },
      {
        name: 'contact',
        type: 'string',
        description: '联系电话',
        required: true,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('make_reservation', args);
      return { text: result.message };
    },
  },
  {
    name: 'book_activity',
    description: '预约景点、演出、展览等非餐饮类活动',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '活动/景点名称',
        required: true,
      },
      {
        name: 'time',
        type: 'string',
        description: '预约时间',
        required: true,
      },
      {
        name: 'people',
        type: 'number',
        description: '参与人数',
        required: true,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('book_activity', args);
      return { text: result.message };
    },
  },
  {
    name: 'check_queue',
    description: '查询餐厅当前排队情况',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '餐厅名称',
        required: true,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('check_queue', args);
      return { text: result.message };
    },
  },
  {
    name: 'join_queue',
    description: '在线取号排队',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '餐厅名称',
        required: true,
      },
      {
        name: 'people',
        type: 'number',
        description: '用餐人数',
        required: true,
      },
      {
        name: 'contact',
        type: 'string',
        description: '联系电话',
        required: true,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('join_queue', args);
      return { text: result.message };
    },
  },
  {
    name: 'calculate_route',
    description: '计算多个地点之间的最优出行路线和时间',
    parameters: [
      {
        name: 'activities',
        type: 'array',
        description: '按顺序排列的地点名称列表',
        required: true,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('calculate_route', args);
      return { text: result.message };
    },
  },
  {
    name: 'adjust_timeline',
    description: '动态调整行程时间分配，根据实际情况优化后续活动时间',
    parameters: [
      {
        name: 'current_activity',
        type: 'string',
        description: '当前活动的名称',
        required: true,
      },
      {
        name: 'actual_duration',
        type: 'number',
        description: '实际花费时间（分钟）',
        required: true,
      },
      {
        name: 'remaining_activities',
        type: 'array',
        description: '剩余活动列表',
        required: true,
      },
    ],
    handler: async (args) => {
      const actualDuration = args.actual_duration as number;
      const remaining = (args.remaining_activities as string[]) || [];
      const adjustment = Math.max(0, actualDuration - 60);
      const adjusted = remaining.map((name, i) => ({
        name,
        suggestedDelay: Math.min(adjustment, (i + 1) * 15),
      }));
      return {
        text:
          adjustment > 0
            ? `已自动调整：后续活动建议顺延 ${adjustment} 分钟\n${adjusted.map((a) => `• ${a.name}: +${a.suggestedDelay}分钟`).join('\n')}`
            : '时间安排正常，无需调整',
        cardData: { adjusted },
      };
    },
  },
  {
    name: 'find_alternative',
    description: '当预订失败时，查找替代商家或活动方案',
    parameters: [
      {
        name: 'failed_item',
        type: 'string',
        description: '失败的商家或活动名称',
        required: true,
      },
      {
        name: 'reason',
        type: 'string',
        description: '失败原因（如"无座"、"售罄"、"时间冲突"）',
        required: true,
      },
      {
        name: 'type',
        type: 'string',
        description: '类型：restaurant（餐厅）或 activity（景点活动）',
        required: true,
      },
    ],
    handler: async (args) => {
      const activity: Partial<Activity> = {
        title: args.failed_item as string,
        type: args.type as 'food' | 'activity',
      };
      const reasonMap: Record<string, 'no_seat' | 'no_ticket' | 'time_conflict'> = {
        无座: 'no_seat',
        满座: 'no_seat',
        售罄: 'no_ticket',
        无票: 'no_ticket',
        冲突: 'time_conflict',
        时间冲突: 'time_conflict',
      };
      const reason = reasonMap[args.reason as string] || 'no_seat';
      const alternatives = getFailureAlternatives(activity as Activity, reason);
      return {
        text: `已为你找到 ${alternatives.length} 个替代方案：\n${alternatives.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
        cardData: { alternatives },
      };
    },
  },
  {
    name: 'dispatch_taxi',
    description: '为行程段预约车辆，适合多人、老人、儿童同行场景',
    parameters: [
      {
        name: 'from',
        type: 'string',
        description: '上车点名称',
        required: true,
      },
      {
        name: 'to',
        type: 'string',
        description: '下车点名称',
        required: true,
      },
      {
        name: 'time',
        type: 'string',
        description: '计划出发时间',
        required: true,
      },
      {
        name: 'people',
        type: 'number',
        description: '乘车人数',
        required: true,
      },
    ],
    handler: async (args) => {
      const result = await executeToolByName('dispatch_taxi', args);
      return { text: result.message };
    },
  },
];
