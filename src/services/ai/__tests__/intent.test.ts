import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

describe('意图识别 - 外卖/配送需求', () => {
  it('应该识别"我想喝奶茶"为配送意图', () => {
    const result = detectIntent('我想喝奶茶');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"点杯咖啡"为配送意图', () => {
    const result = detectIntent('点杯咖啡');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"叫杯奶茶"为配送意图', () => {
    const result = detectIntent('叫杯奶茶');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"来杯饮料"为配送意图', () => {
    const result = detectIntent('来杯饮料');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"点个汉堡"为配送意图', () => {
    const result = detectIntent('点个汉堡');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"叫个炸鸡"为配送意图', () => {
    const result = detectIntent('叫个炸鸡');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"来点甜品"为配送意图', () => {
    const result = detectIntent('来点甜品');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"要个披萨"为配送意图', () => {
    const result = detectIntent('要个披萨');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"点一份快餐"为配送意图', () => {
    const result = detectIntent('点一份快餐');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"想喝点什么"为配送意图', () => {
    const result = detectIntent('想喝点什么');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"想吃点什么"为配送意图', () => {
    const result = detectIntent('想吃点什么');
    expect(result.type).toBe('delivery');
  });

  it('应该识别"叫份外卖"为配送意图', () => {
    const result = detectIntent('叫份外卖');
    expect(result.type).toBe('delivery');
  });
});

describe('意图识别 - 餐厅/堂食需求', () => {
  it('应该识别"找家餐厅吃饭"为餐厅意图', () => {
    const result = detectIntent('找家餐厅吃饭');
    expect(result.type).toBe('restaurant');
  });

  it('应该识别"推荐好吃的"为餐厅意图', () => {
    const result = detectIntent('推荐好吃的');
    expect(result.type).toBe('restaurant');
  });

  it('应该识别"附近有什么好吃的"为餐厅意图', () => {
    const result = detectIntent('附近有什么好吃的');
    expect(result.type).toBe('restaurant');
  });

  it('应该识别"去哪吃"为餐厅意图', () => {
    const result = detectIntent('去哪吃');
    expect(result.type).toBe('restaurant');
  });

  it('应该识别"聚餐去哪"为餐厅意图', () => {
    const result = detectIntent('聚餐去哪');
    expect(result.type).toBe('restaurant');
  });
});

describe('意图识别 - 其他服务', () => {
  it('应该识别"查天气"为天气意图', () => {
    const result = detectIntent('查天气');
    expect(result.type).toBe('weather');
  });

  it('应该识别"明天天气怎么样"为天气意图', () => {
    const result = detectIntent('明天天气怎么样');
    expect(result.type).toBe('weather');
  });

  it('应该识别"看电影"为票务意图', () => {
    const result = detectIntent('看电影');
    expect(result.type).toBe('ticket');
  });

  it('应该识别"今晚有什么电影"为票务意图', () => {
    const result = detectIntent('今晚有什么电影');
    expect(result.type).toBe('ticket');
  });

  it('应该识别"有没有优惠券"为优惠券意图', () => {
    const result = detectIntent('有没有优惠券');
    expect(result.type).toBe('coupon');
  });

  it('应该识别"有什么优惠"为优惠券意图', () => {
    const result = detectIntent('有什么优惠');
    expect(result.type).toBe('coupon');
  });
});

describe('意图识别 - 行程规划', () => {
  it('应该识别"周末去哪玩"为规划意图', () => {
    const result = detectIntent('周末去哪玩');
    expect(result.type).toBe('plan');
  });

  it('应该识别"规划一下行程"为规划意图', () => {
    const result = detectIntent('规划一下行程');
    expect(result.type).toBe('plan');
  });

  it('应该识别"安排一下周末"为规划意图', () => {
    const result = detectIntent('安排一下周末');
    expect(result.type).toBe('plan');
  });
});

describe('意图识别 - 闲聊', () => {
  it('应该识别"你好"为聊天意图', () => {
    const result = detectIntent('你好');
    expect(result.type).toBe('chat');
  });

  it('应该识别"谢谢"为聊天意图', () => {
    const result = detectIntent('谢谢');
    expect(result.type).toBe('chat');
  });

  it('应该识别"在吗"为聊天意图', () => {
    const result = detectIntent('在吗');
    expect(result.type).toBe('chat');
  });
});
