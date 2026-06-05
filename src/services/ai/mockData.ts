import { getFeedImage } from '../imageLibrary';
import { seededInt, seededFloat } from '../../utils/seededRandom';
import { Activity, Plan } from './types';

export function generateRestaurantMockData(keywords: string, city: string) {
  const q = keywords.toLowerCase();
  const isCafe = /咖啡|咖啡馆|下午茶|甜品/.test(q);
  const isHotpot = /火锅|烤肉|烧烤/.test(q);

  const restaurantPool = isCafe
    ? {
        categories: [
          '咖啡馆',
          '下午茶',
          '甜品',
          '手冲',
          'Brunch',
          '安静自习',
          '露台咖啡',
          '社区小馆',
        ],
        names: [
          `${city}·慢调咖啡`,
          `${city}·树影 Coffee`,
          `午后三点甜品研究所`,
          `Corner Bean 手冲咖啡`,
          `Breeze Brunch Cafe`,
          `留白咖啡馆`,
          `日落露台咖啡`,
          `巷口可颂与拿铁`,
        ],
        tags: [
          ['安静坐坐', '适合独处'],
          ['甜品不错', '拍照好看'],
          ['巴斯克招牌', '下午茶'],
          ['手冲精品', '豆单丰富'],
          ['早午餐', '光线舒服'],
          ['可久坐', '插座友好'],
          ['露台位', '适合聊天'],
          ['社区氛围', '可外带'],
        ],
      }
    : isHotpot
      ? {
          categories: ['火锅', '烤肉', '烧烤', '铜锅涮肉', '韩式烤肉', '夜宵'],
          names: [
            `${city}·鼎鼎香火锅`,
            `${city}炭火烤肉`,
            `不只是烧鸟·精酿小馆`,
            `九宫格铜锅涮肉`,
            `首尔炭火烤肉屋`,
            `巷口烟火烧烤`,
            `椒香毛肚火锅`,
            `夜半炉边烤肉`,
          ],
          tags: [
            ['朋友聚餐', '锅底稳'],
            ['肉质在线', '适合聚会'],
            ['宵夜氛围', '小酒馆'],
            ['老北京味', '排队热门'],
            ['韩式风味', '双人餐'],
            ['夜宵首选', '烟火气'],
            ['毛肚招牌', '辣度可调'],
            ['围炉感强', '下班小聚'],
          ],
        }
      : {
          categories: ['火锅', '日料', '西餐', '烧烤', '川菜', '粤菜', '湘菜', '咖啡馆'],
          names: [
            `${city}·鼎鼎香火锅`,
            `樱花日料(${city}店)`,
            `La Vie 法式餐厅`,
            `${city}炭火烤肉`,
            `蜀香门第川菜馆`,
            `岭南小厨(${city}店)`,
            `湘辣坊(${city}店)`,
            `${city}·精品咖啡馆`,
          ],
          tags: [
            ['必吃榜', '排队王'],
            ['精致料理', '约会首选'],
            ['米其林推荐', '环境优雅'],
            ['深夜食堂', '朋友聚餐'],
            ['正宗川味', '辣度可调'],
            ['早茶推荐', '老字号'],
            ['地道湘菜', '下饭神器'],
            ['网红打卡', '手冲精品'],
          ],
        };

  return restaurantPool.names.slice(0, 8).map((name, i) => ({
    id: `r_${i}`,
    name,
    rating: seededFloat(`${city}${keywords}${name}rating`, 4.2, 4.9),
    avgPrice: seededInt(`${city}${keywords}${name}price`, 60, 220),
    distance: `${(seededInt(`${city}${keywords}${name}distance`, 3, 42) / 10).toFixed(1)}km`,
    category: restaurantPool.categories[i % restaurantPool.categories.length],
    tags: restaurantPool.tags[i % restaurantPool.tags.length],
    address: `${city}市商业中心${i + 1}号`,
    image: getFeedImage(
      `${keywords} ${restaurantPool.categories[i % restaurantPool.categories.length]} ${name}`,
      `restaurant_${i}`
    ),
  }));
}

export function generateDeliveryMockData(keywords: string, city: string) {
  const categories = ['快餐', '奶茶', '轻食', '中餐', '甜品', '炸鸡'];
  const names = [
    `${city}·黄焖鸡米饭`,
    '喜茶(万达店)',
    '超级碗轻食',
    `${city}·老北京炸酱面`,
    `满记甜品(步行街店)`,
    `正新鸡排(${city}店)`,
  ];
  const times = ['20分钟', '25分钟', '30分钟', '15分钟', '35分钟', '20分钟'];
  const fees = [3, 0, 4, 3, 5, 2];

  return names.map((name, i) => ({
    id: `d_${i}`,
    name,
    category: categories[i % categories.length],
    rating: seededFloat(`${city}${keywords}${name}rating`, 4.1, 4.8),
    deliveryTime: times[i],
    deliveryFee: fees[i],
    avgPrice: seededInt(`${city}${keywords}${name}price`, 15, 60),
    tags: [`月售${seededInt(`${city}${keywords}${name}sales`, 800, 5200)}`, '好评如潮'],
    image: getFeedImage(
      `${keywords} ${categories[i % categories.length]} ${name}`,
      `delivery_${i}`
    ),
  }));
}

export function generateTicketMockData(keywords: string, city: string) {
  const items = [
    {
      name: `${city}当代艺术展`,
      venue: `${city}美术馆`,
      time: '10:00-18:00',
      price: 78,
      rating: 4.7,
    },
    { name: '开心麻花话剧', venue: `${city}大剧院`, time: '19:30-21:30', price: 180, rating: 4.8 },
    {
      name: `${city}欢乐世界`,
      venue: `${city}欢乐世界主题乐园`,
      time: '09:00-21:00',
      price: 238,
      rating: 4.5,
    },
    { name: '沉浸式光影展', venue: `${city}科技馆`, time: '10:00-20:00', price: 128, rating: 4.6 },
  ];

  return items.map((item, i) => ({
    id: `t_${i}`,
    ...item,
    date: '本周末',
    tags: ['热门', '限时优惠'],
    image: getFeedImage(`${keywords} ${item.name} ${item.venue}`, `ticket_${i}`),
  }));
}

export function generateCouponMockData(city: string) {
  return [
    {
      id: 'c_1',
      shopName: '海底捞火锅',
      discount: '¥30',
      condition: '满200可用',
      validUntil: '05-31',
      category: '火锅',
    },
    {
      id: 'c_2',
      shopName: '星巴克',
      discount: '¥15',
      condition: '满60可用',
      validUntil: '05-25',
      category: '咖啡',
    },
    {
      id: 'c_3',
      shopName: `${city}万达影城`,
      discount: '¥20',
      condition: '满100可用',
      validUntil: '06-01',
      category: '电影',
    },
    {
      id: 'c_4',
      shopName: '喜茶',
      discount: '¥8',
      condition: '满30可用',
      validUntil: '05-20',
      category: '茶饮',
    },
  ];
}

export function generateMockPlan(query: string, city: string): Plan {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const activities: Activity[] = [
    {
      id: '1',
      timeLine: '14:00-15:30',
      title: `${city}热门咖啡馆`,
      type: 'food',
      description: '环境优雅，适合聊天放松',
      price: 88,
      imageUrl: getFeedImage(`${city} 热门咖啡馆 下午茶`, 'mock_food_1'),
      distanceInfo: '距离 1.2km',
      tags: ['网红打卡', '下午茶'],
      reasoning: '环境舒适，适合开场',
      teamFit: '适合所有人',
    },
    {
      id: '2',
      timeLine: '15:30-17:00',
      title: `${city}文化展览`,
      type: 'activity',
      description: '沉浸式艺术展览，拍照出片',
      price: 128,
      imageUrl: getFeedImage(`${city} 文化展览 艺术空间`, 'mock_activity_2'),
      distanceInfo: '距离 2.0km',
      tags: ['看展', '拍照'],
      reasoning: '文艺氛围，增加行程亮点',
      teamFit: '适合喜欢艺术的同行人',
    },
    {
      id: '3',
      timeLine: '17:30-19:00',
      title: `${city}人气餐厅`,
      type: 'food',
      description: '本地口碑餐厅，招牌菜必点',
      price: 158,
      imageUrl: getFeedImage(`${city} 人气餐厅 晚餐 聚餐`, 'mock_food_3'),
      distanceInfo: '距离 1.8km',
      tags: ['美食', '聚餐'],
      reasoning: '菜品丰富，满足不同口味',
      teamFit: '适合所有人',
    },
  ];
  return {
    id: `plan_${Date.now()}`,
    title: `${city}半日休闲之旅`,
    durationTags: '约5小时',
    tags: ['轻松减压', '美食探店'],
    summary: `[本地模板] 精选${city}热门去处，品味美食与文化`,
    city,
    date: `${month}-${day}`,
    activities,
    totalPrice: activities.reduce((s, a) => s + a.price, 0),
    strategy: '[本地模板] 根据用户需求精选',
    conflictResolution: '个人出行',
  };
}

export function generateFallbackUIStrategy(plan: Plan): Plan['uiStrategy'] {
  let variant: 'romantic' | 'family' | 'business' | 'default' = 'default';
  const titleAndTags = `${plan.title} ${(plan.tags || []).join(' ')}`.toLowerCase();

  if (/约会|情侣|纪念日|date|romantic|周年|甜蜜/.test(titleAndTags)) {
    variant = 'romantic';
  } else if (/亲子|家庭|孩子|family|小孩|宝宝|老人|爸妈|父母/.test(titleAndTags)) {
    variant = 'family';
  } else if (/商务|出差|工作|business|会议|客户|团建/.test(titleAndTags)) {
    variant = 'business';
  }

  const emphasis: string[] = [];
  const foodActivity = plan.activities.find((a) => a.type === 'food');
  const travelActivity = plan.activities.find((a) => a.type === 'travel');
  const activityActivity = plan.activities.find((a) => a.type === 'activity');

  if (foodActivity) emphasis.push(foodActivity.id);
  if (travelActivity) {
    emphasis.push(travelActivity.id);
  } else if (activityActivity && emphasis.length < 2) {
    emphasis.push(activityActivity.id);
  }

  const warnings: { id: string; message: string; severity: 'info' | 'warning' | 'danger' }[] = [];
  let warnCounter = 0;

  if (plan.totalPrice > 1000) {
    warnings.push({
      id: `warn_${++warnCounter}`,
      message: `总预算 ¥${plan.totalPrice} 超过 ¥1000，建议拆分活动或选择更经济的方案`,
      severity: 'danger',
    });
  } else if (plan.totalPrice > 500) {
    warnings.push({
      id: `warn_${++warnCounter}`,
      message: `总预算 ¥${plan.totalPrice} 较高，建议确认是否符合预期`,
      severity: 'warning',
    });
  }

  for (let i = 0; i < plan.activities.length - 1; i++) {
    const currentEnd = plan.activities[i].timeLine.split('-')[1];
    const nextStart = plan.activities[i + 1].timeLine.split('-')[0];
    if (currentEnd && nextStart) {
      const [endH, endM] = currentEnd.split(':').map(Number);
      const [startH, startM] = nextStart.split(':').map(Number);
      if (!isNaN(endH) && !isNaN(endM) && !isNaN(startH) && !isNaN(startM)) {
        const gapMin = startH * 60 + startM - (endH * 60 + endM);
        if (gapMin >= 0 && gapMin < 30) {
          warnings.push({
            id: `warn_${++warnCounter}`,
            message: `"${plan.activities[i].title}" 和 "${plan.activities[i + 1].title}" 之间仅间隔 ${gapMin} 分钟，时间较紧`,
            severity: 'warning',
          });
        }
      }
    }
  }

  const suggestedActions = [
    { icon: 'route', label: '帮我优化路线顺序', prompt: '帮我优化路线顺序' },
    { icon: 'restaurant', label: '换个餐厅推荐', prompt: '换个餐厅推荐' },
    { icon: 'weather', label: '查看天气预报', prompt: '查看天气预报' },
  ];

  return { variant, emphasis, warnings, suggestedActions };
}
