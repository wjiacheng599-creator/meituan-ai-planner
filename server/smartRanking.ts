export interface Activity {
  id: string;
  timeLine: string;
  title: string;
  type: 'food' | 'travel' | 'attraction';
  description: string;
  price: number;
  tags: string[];
  reasoning?: string;
}

import type { UserPreference } from './userPreference';

export interface ScoredActivity {
  activity: Activity;
  score: number;
  factors: Array<{ name: string; weight: number; value: number; description: string }>;
}

export interface RecommendationContext {
  weather?: { condition: string; temp: number };
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  distance?: number;
}

export function scoreActivity(
  activity: Activity,
  preferences: UserPreference,
  context: RecommendationContext
): ScoredActivity {
  const factors: ScoredActivity['factors'] = [];
  let totalScore = 0;

  const priceWeight = 0.2;
  const categoryWeight = 0.25;
  const weatherWeight = 0.2;
  const distanceWeight = 0.15;
  const timeWeight = 0.1;
  const dietaryWeight = 0.1;

  const priceScore = activity.price >= preferences.priceRange.min && 
                     activity.price <= preferences.priceRange.max ? 1 : 
                     activity.price < preferences.priceRange.min ? 0.8 : 0.6;
  factors.push({
    name: '价格匹配',
    weight: priceWeight,
    value: priceScore,
    description: `¥${activity.price}在${preferences.priceRange.min}-${preferences.priceRange.max}范围内`,
  });
  totalScore += priceScore * priceWeight;

  let categoryScore = 0.5;
  for (const cat of preferences.favoriteCategories) {
    if (activity.tags.some(tag => tag.includes(cat))) {
      categoryScore = 1;
      break;
    }
  }
  for (const cat of preferences.avoidCategories) {
    if (activity.tags.some(tag => tag.includes(cat))) {
      categoryScore = 0.2;
      break;
    }
  }
  factors.push({
    name: '类别偏好',
    weight: categoryWeight,
    value: categoryScore,
    description: preferences.favoriteCategories.length > 0 
      ? `匹配偏好: ${preferences.favoriteCategories.join(', ')}`
      : '无偏好数据',
  });
  totalScore += categoryScore * categoryWeight;

  let weatherScore = 0.7;
  if (context.weather) {
    const isOutdoor = activity.tags.some(tag => 
      /公园|户外|江边|景点|沙滩/.test(tag)
    );
    const isBadWeather = /雨|雪|雷|雾|霾|沙尘/.test(context.weather.condition);
    const isExtremeTemp = context.weather.temp < 5 || context.weather.temp > 35;

    if (isOutdoor && isBadWeather) {
      weatherScore = 0.2;
    } else if (isOutdoor && !isBadWeather && !isExtremeTemp) {
      weatherScore = 0.9;
    } else if (isOutdoor && isExtremeTemp) {
      weatherScore = 0.3;
    } else {
      weatherScore = 0.8;
    }
  }
  factors.push({
    name: '天气适配',
    weight: weatherWeight,
    value: weatherScore,
    description: context.weather 
      ? `${context.weather.condition} ${context.weather.temp}°C`
      : '无天气数据',
  });
  totalScore += weatherScore * weatherWeight;

  let distanceScore = 0.7;
  if (context.distance && context.distance > 0) {
    distanceScore = Math.max(0.3, 1 - context.distance / 10000);
  }
  factors.push({
    name: '距离',
    weight: distanceWeight,
    value: distanceScore,
    description: context.distance 
      ? `约${(context.distance / 1000).toFixed(1)}km`
      : '无距离数据',
  });
  totalScore += distanceScore * distanceWeight;

  let timeScore = 0.8;
  if (context.timeOfDay) {
    const timeline = activity.timeLine;
    if (timeline.includes('早') || timeline.includes('上午') || timeline.includes('09:') || timeline.includes('10:')) {
      timeScore = context.timeOfDay === 'morning' ? 1 : 0.6;
    } else if (timeline.includes('午') || timeline.includes('中') || timeline.includes('12:') || timeline.includes('14:')) {
      timeScore = context.timeOfDay === 'afternoon' ? 1 : 0.6;
    } else if (timeline.includes('晚') || timeline.includes('夜') || timeline.includes('18:') || timeline.includes('20:')) {
      timeScore = context.timeOfDay === 'evening' ? 1 : 0.6;
    }
  }
  factors.push({
    name: '时间匹配',
    weight: timeWeight,
    value: timeScore,
    description: context.timeOfDay 
      ? `当前时段: ${context.timeOfDay}`
      : '无时段偏好',
  });
  totalScore += timeScore * timeWeight;

  let dietaryScore = 1;
  for (const restriction of preferences.dietaryRestrictions) {
    if (activity.description.includes(restriction) || activity.title.includes(restriction)) {
      dietaryScore = 0;
      break;
    }
  }
  factors.push({
    name: '饮食限制',
    weight: dietaryWeight,
    value: dietaryScore,
    description: preferences.dietaryRestrictions.length > 0 
      ? `避开: ${preferences.dietaryRestrictions.join(', ')}`
      : '无限制',
  });
  totalScore += dietaryScore * dietaryWeight;

  return {
    activity,
    score: totalScore,
    factors,
  };
}

export function rankActivities(
  activities: Activity[],
  preferences: UserPreference,
  context: RecommendationContext
): ScoredActivity[] {
  const scored = activities.map(activity => scoreActivity(activity, preferences, context));
  return scored.sort((a, b) => b.score - a.score);
}

export function getTopRecommendations(
  activities: Activity[],
  preferences: UserPreference,
  context: RecommendationContext,
  limit: number = 5
): Activity[] {
  const ranked = rankActivities(activities, preferences, context);
  return ranked.slice(0, limit).map(s => s.activity);
}

export function explainRecommendation(scored: ScoredActivity): string {
  const sortedFactors = [...scored.factors].sort((a, b) => b.weight * b.value - a.weight * a.value);
  const topFactors = sortedFactors.slice(0, 3);
  
  return `${scored.activity.title} (综合得分: ${(scored.score * 100).toFixed(0)}%)
  
推荐理由:
${topFactors.map((f, i) => `${i + 1}. ${f.name} (${(f.value * 100).toFixed(0)}%): ${f.description}`).join('\n')}`;
}
