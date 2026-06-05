import type { PersonProfile } from '../../types';
import type { Plan } from './types';
import type { PlannerTaskState, TaskSession } from '../../types';
import type { DynamicSuggestionCard } from '../../components/screens/home/DynamicSuggestions';
import type { WeatherCardData } from '../../components/cards/WeatherCard';

interface RecommenderInput {
  profiles: PersonProfile[];
  savedPlans: Plan[];
  plannerTaskStates: PlannerTaskState[];
  taskSessions: TaskSession[];
  activeSessionPlan: Plan | null;
  weather: WeatherCardData | null;
  recentTopicKeys: string[];
}

interface SceneContext {
  hour: number;
  isWeekend: boolean;
  isEvening: boolean;
  isNight: boolean;
  isMorning: boolean;
  isRainy: boolean;
  isCold: boolean;
  isHot: boolean;
  hasChild: boolean;
  hasElderly: boolean;
  hasCouple: boolean;
  groupSize: number;
  hasHistory: boolean;
  hasActivePlan: boolean;
  topPreference: string | undefined;
  styleTags: string[];
  completedCount: number;
}

const STYLE_TAG_CARD_MAP: Record<string, DynamicSuggestionCard> = {
  '美食爱好者': {
    icon: null,
    title: '美食探店',
    desc: '跟着味蕾走',
    prompt: '按我爱美食的偏好，规划一条今天能出发的路线，重点安排好吃的。',
    topicKey: 'foodie',
  },
  '探索型': {
    icon: null,
    title: '去没去过的地方',
    desc: '发现新角落',
    prompt: '推荐一条我没去过的本地路线，最好是小众但值得探索的地方。',
    topicKey: 'explore',
  },
  '精打细算': {
    icon: null,
    title: '省钱好去处',
    desc: '花小钱办大事',
    prompt: '帮我规划一条性价比高的半日路线，别太贵但体验要好。',
    topicKey: 'budget',
  },
  '品质优先': {
    icon: null,
    title: '精选体验',
    desc: '值得花的都安排',
    prompt: '推荐一条品质感强的路线，不用太在意价格，体验要好。',
    topicKey: 'premium',
  },
  '文艺青年': {
    icon: null,
    title: '文艺漫步',
    desc: '有调调的路线',
    prompt: '规划一条文艺气息浓的路线，展览、独立书店、咖啡馆、艺术空间都行。',
    topicKey: 'artsy',
  },
};

const TIME_CARDS: Record<string, DynamicSuggestionCard> = {
  morning: {
    icon: null,
    title: '早上好去哪',
    desc: '元气满满出发',
    prompt: '今天上午有空，帮我安排一条上午出发的轻松路线，控制在 3-4 小时。',
    topicKey: 'morning',
  },
  afternoon: {
    icon: null,
    title: '现在去哪',
    desc: '说走就能走',
    prompt: '今天下午就有空，帮我安排一条现在就能出发的本地路线，别太折腾。',
    topicKey: 'afternoon',
  },
  evening: {
    icon: null,
    title: '今晚去哪',
    desc: '下班直接走',
    prompt: '现在是傍晚，帮我规划一条下班后能直接出发的轻松路线，控制在 3-4 小时。',
    topicKey: 'evening',
  },
  night: {
    icon: null,
    title: '夜间好去处',
    desc: '夜生活安排上',
    prompt: '现在比较晚了，帮我推荐附近适合晚上去的地方，酒吧、夜宵、夜间散步都行。',
    topicKey: 'night',
  },
};

const WEATHER_CARDS: Record<string, DynamicSuggestionCard> = {
  rainy: {
    icon: null,
    title: '室内好去处',
    desc: '下雨不怕',
    prompt: '今天下雨了，帮我规划一条室内为主的路线，逛展、商场、咖啡馆都行。',
    topicKey: 'indoor',
  },
  cold: {
    icon: null,
    title: '暖和的地方',
    desc: '不想冻着',
    prompt: '今天比较冷，帮我安排一条暖和的路线，室内为主，喝点热的。',
    topicKey: 'warm',
  },
  hot: {
    icon: null,
    title: '凉快好去处',
    desc: '避暑去',
    prompt: '今天太热了，帮我找凉快的地方，有空调的商场、室内景点或者水上活动。',
    topicKey: 'cool',
  },
};

const SCENE_CARDS: Record<string, DynamicSuggestionCard> = {
  weekend: {
    icon: null,
    title: '周末好时光',
    desc: '好好享受',
    prompt: '今天是周末，帮我规划一条适合放松享受的半日路线，不用赶时间。',
    topicKey: 'weekend',
  },
  family: {
    icon: null,
    title: '带娃去哪玩',
    desc: '轻松半日',
    prompt: '今天想带孩子出门玩 4-6 小时，别太累，顺便安排一个适合家庭的晚餐。',
    topicKey: 'family',
  },
  elder: {
    icon: null,
    title: '陪长辈走走',
    desc: '安静少走路',
    prompt: '今天想陪长辈在附近轻松活动 4-5 小时，少走路，安排一个安静好坐的餐厅。',
    topicKey: 'elder',
  },
  couple: {
    icon: null,
    title: '去哪约会',
    desc: '氛围感路线',
    prompt: '今天想和伴侣在附近约会 4-6 小时，希望路线有氛围、适合拍照，再安排一顿体验好的晚餐。2个人。',
    topicKey: 'couple',
  },
  group: {
    icon: null,
    title: '朋友去哪聚',
    desc: '热闹不无聊',
    prompt: '今天想和朋友一起出去玩 4-6 小时，希望有聊天氛围，也能顺便安排聚餐。',
    topicKey: 'group',
  },
  photo: {
    icon: null,
    title: '去哪出片',
    desc: '氛围更好拍',
    prompt: '按我喜欢拍照和有氛围的偏好，推荐一条今天可出发的半日路线。',
    topicKey: 'photo',
  },
  coffee: {
    icon: null,
    title: '喝杯咖啡',
    desc: '安静坐坐',
    prompt: '想找一条轻松的附近路线，先散步再喝咖啡，如果合适的话再安排一顿晚餐。',
    topicKey: 'coffee',
  },
};

const HISTORY_CARDS: Record<string, DynamicSuggestionCard> = {
  'fresh-restart': {
    icon: null,
    title: '换个新玩法',
    desc: '别和上次一样',
    prompt: '不要沿用我上次的方向，给我一条更有新鲜感的新方案。',
    topicKey: 'fresh-restart',
  },
  remix: {
    icon: null,
    title: '换种玩法',
    desc: '来点新感觉',
    prompt: '基于我最近的行程，换一种风格再规划一版。',
    topicKey: 'remix',
  },
  'repeat-style': {
    icon: null,
    title: '照这个风格',
    desc: '继续你会喜欢',
    prompt: '参考我之前完成过的路线，推荐一个风格相近的新半日安排。',
    topicKey: 'repeat-style',
  },
};

const FALLBACK_CARDS: DynamicSuggestionCard[] = [
  {
    icon: null,
    title: '找家餐厅',
    desc: '附近好吃的',
    prompt: '帮我推荐一家附近适合现在去吃的餐厅，环境和口味都要靠谱。',
    topicKey: 'eat',
  },
  {
    icon: null,
    title: '附近逛逛',
    desc: '别跑太远',
    prompt: '帮我规划一条附近 3 公里内的轻松半日路线。',
    topicKey: 'nearby',
  },
];

function buildSceneContext(input: RecommenderInput): SceneContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  const safeProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  const safePlannerTaskStates = Array.isArray(input.plannerTaskStates) ? input.plannerTaskStates : [];
  const safeSavedPlans = Array.isArray(input.savedPlans) ? input.savedPlans : [];

  const hasChild = safeProfiles.some((p) => p.ageGroup === '儿童');
  const hasElderly = safeProfiles.some((p) => p.ageGroup === '老年');
  const hasCouple = safeProfiles.some((p) => p.relation === '伴侣');
  const groupSize = safeProfiles.length;

  const completedPlanIds = new Set(
    safePlannerTaskStates
      .filter((t) => t.status === 'completed' || t.status === 'archived')
      .map((t) => t.planId)
  );
  const completedCount = safeSavedPlans.filter((p) => completedPlanIds.has(p.id || '')).length;
  const hasBooked = safePlannerTaskStates.some((t) => t.bookedActivityIds.length > 0);
  const hasDraftTask = Array.isArray(input.taskSessions)
    ? input.taskSessions.some((s) => s.status === 'planning' || s.status === 'draft')
    : false;

  const weather = input.weather;
  const temp = weather?.temp;
  const weatherText = (weather?.condition || weather?.advice || '').toLowerCase();

  const mainProfile = safeProfiles[0];
  const topPreference = mainProfile?.travelPreferences?.[0];

  return {
    hour,
    isWeekend,
    isEvening: hour >= 17 && hour < 21,
    isNight: hour >= 21,
    isMorning: hour >= 6 && hour < 12,
    isRainy: weatherText.includes('雨') || weatherText.includes('rain'),
    isCold: temp !== undefined && temp < 10,
    isHot: temp !== undefined && temp > 33,
    hasChild,
    hasElderly,
    hasCouple,
    groupSize,
    hasHistory: completedCount > 0 || hasBooked || hasDraftTask || safeSavedPlans.length > 0,
    hasActivePlan: !!input.activeSessionPlan,
    topPreference,
    styleTags: [],
    completedCount,
  };
}

function pickCardsFromScene(scene: SceneContext, input: RecommenderInput): DynamicSuggestionCard[] {
  const candidates: Array<{ card: DynamicSuggestionCard; priority: number }> = [];

  // Layer 1: 场景感知（天气 + 时间 + 周末）
  if (scene.isRainy) {
    candidates.push({ card: WEATHER_CARDS.rainy, priority: 95 });
  } else if (scene.isCold) {
    candidates.push({ card: WEATHER_CARDS.cold, priority: 90 });
  } else if (scene.isHot) {
    candidates.push({ card: WEATHER_CARDS.hot, priority: 90 });
  }

  if (scene.isNight) {
    candidates.push({ card: TIME_CARDS.night, priority: 85 });
  } else if (scene.isEvening) {
    candidates.push({ card: TIME_CARDS.evening, priority: 80 });
  } else if (scene.isMorning) {
    candidates.push({ card: TIME_CARDS.morning, priority: 70 });
  } else {
    candidates.push({ card: TIME_CARDS.afternoon, priority: 60 });
  }

  if (scene.isWeekend) {
    candidates.push({ card: SCENE_CARDS.weekend, priority: 75 });
  }

  // Layer 2: 用户画像
  if (scene.hasChild) {
    candidates.push({ card: SCENE_CARDS.family, priority: 90 });
  } else if (scene.hasElderly) {
    candidates.push({ card: SCENE_CARDS.elder, priority: 90 });
  } else if (scene.hasCouple) {
    candidates.push({ card: SCENE_CARDS.couple, priority: 85 });
  } else if (scene.groupSize > 2) {
    const groupCard = { ...SCENE_CARDS.group };
    groupCard.prompt = `今天想和 ${scene.groupSize} 个人一起出去玩 4-6 小时，希望有聊天氛围，也能顺便安排聚餐。`;
    candidates.push({ card: groupCard, priority: 80 });
  } else {
    candidates.push({ card: SCENE_CARDS.group, priority: 65 });
  }

  if (scene.topPreference?.includes('摄影') || scene.topPreference?.includes('拍照')) {
    candidates.push({ card: SCENE_CARDS.photo, priority: 70 });
  } else {
    candidates.push({ card: SCENE_CARDS.coffee, priority: 55 });
  }

  // DNA style tags → 个性化卡片
  for (const tag of scene.styleTags) {
    const card = STYLE_TAG_CARD_MAP[tag];
    if (card) {
      candidates.push({ card, priority: 65 });
    }
  }

  // 历史卡片
  if (scene.hasActivePlan || scene.hasHistory) {
    if (input.activeSessionPlan?.title) {
      const card = { ...HISTORY_CARDS['fresh-restart'] };
      card.prompt = `不要继续上次那条「${input.activeSessionPlan.title}」，换一个更新鲜的本地生活方案。`;
      candidates.push({ card, priority: 50 });
    } else if (input.savedPlans.length > 0 && input.savedPlans[0]?.title) {
      const card = { ...HISTORY_CARDS.remix };
      card.prompt = `基于我最近的「${input.savedPlans[0].title}」，换一种风格再规划一版。`;
      candidates.push({ card, priority: 45 });
    } else if (scene.completedCount > 0) {
      const card = { ...HISTORY_CARDS['repeat-style'] };
      card.prompt = `参考我之前完成过的 ${scene.completedCount} 条路线，推荐一个风格相近的新半日安排。`;
      candidates.push({ card, priority: 40 });
    }
  }

  // Fallback
  for (const card of FALLBACK_CARDS) {
    candidates.push({ card, priority: 20 });
  }

  // Layer 3: 多样性控制 + 排序
  const recentSet = new Set(input.recentTopicKeys);

  candidates.sort((a, b) => {
    const aRecent = recentSet.has(a.card.topicKey) ? -20 : 0;
    const bRecent = recentSet.has(b.card.topicKey) ? -20 : 0;
    return (b.priority + bRecent) - (a.priority + aRecent);
  });

  const seen = new Set<string>();
  const result: DynamicSuggestionCard[] = [];
  for (const { card } of candidates) {
    if (seen.has(card.topicKey)) continue;
    seen.add(card.topicKey);
    result.push(card);
    if (result.length >= 4) break;
  }

  return result;
}

export function recommendCards(input: RecommenderInput): DynamicSuggestionCard[] {
  const scene = buildSceneContext(input);

  // 简易 DNA 标签推断（不依赖完整 travelDNA 计算）
  const styleTags: string[] = [];
  const mainProfile = Array.isArray(input.profiles) ? input.profiles[0] : undefined;
  const prefs = mainProfile?.travelPreferences || [];
  if (prefs.some((p) => p.includes('美食') || p.includes('吃'))) styleTags.push('美食爱好者');
  if (prefs.some((p) => p.includes('探索') || p.includes('小众'))) styleTags.push('探索型');
  if (prefs.some((p) => p.includes('文艺') || p.includes('展览'))) styleTags.push('文艺青年');
  scene.styleTags = styleTags;

  return pickCardsFromScene(scene, input);
}
