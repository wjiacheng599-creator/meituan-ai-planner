import { dataSource, resolveUserCity, fetchWeatherFromAmap, translateWeather } from '../apiAdapter';
import { WeatherInfo, WeatherImpactAssessment, Activity } from './types';

const WEATHER_API_TIMEOUT_MS = 5000;
const isDev =
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV);

export function getWeatherIcon(condition: string, temp: number): string {
  if (condition.includes('雨') || condition.includes('rain')) return '🌧️';
  if (condition.includes('雪') || condition.includes('snow')) return '🌨️';
  if (condition.includes('雷') || condition.includes('thunder')) return '⛈️';
  if (condition.includes('雾') || condition.includes('霾') || condition.includes('fog'))
    return '🌫️';
  if (condition.includes('云') || condition.includes('阴') || condition.includes('cloud'))
    return '☁️';
  if (temp >= 35) return '🔥';
  if (temp <= 0) return '🥶';
  return '☀️';
}

export function getWeatherAdvice(temp: number, condition: string): string {
  if (condition.includes('雨')) return '记得带伞，室内活动为主';
  if (condition.includes('雪')) return '注意保暖防滑，路面可能结冰';
  if (temp >= 35) return '高温预警！多补充水分，避免长时间户外';
  if (temp >= 30) return '较热，注意防晒，多带水';
  if (temp >= 20) return '温度舒适，适合出行';
  if (temp >= 10) return '微凉，建议带件薄外套';
  return '较冷，注意保暖';
}

export async function getUserCity(): Promise<string> {
  return resolveUserCity();
}

export async function fetchWeather(city?: string): Promise<WeatherInfo> {
  const resolvedCity = city || (await getUserCity());

  if (dataSource.hasAmap) {
    try {
      const amapWeather = await fetchWeatherFromAmap(resolvedCity);
      if (amapWeather) {
        const { temp, condition, humidity, forecast } = amapWeather;
        const high = forecast[0]?.high || temp + 3;
        const low = forecast[0]?.low || temp - 3;
        return {
          city: amapWeather.city,
          temp,
          tempRange: `${low}° ~ ${high}°`,
          condition,
          humidity,
          advice: getWeatherAdvice(temp, condition),
          icon: getWeatherIcon(condition, temp),
        };
      }
    } catch (e) {
      if (isDev) console.warn('[fetchWeather] 高德天气API失败:', e);
    }
  }

  try {
    const resp = await fetch(`https://wttr.in/${encodeURIComponent(resolvedCity)}?format=j1`, {
      signal: AbortSignal.timeout(WEATHER_API_TIMEOUT_MS),
    });
    if (resp.ok) {
      const data = await resp.json();
      const current = data.current_condition?.[0];
      if (current) {
        const temp = parseInt(current.temp_C) || 24;
        const desc = translateWeather(
          current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '晴'
        );
        return {
          city: resolvedCity,
          temp,
          tempRange: `${data.weather?.[0]?.mintempC || temp - 3}° ~ ${data.weather?.[0]?.maxtempC || temp + 3}°`,
          condition: desc,
          humidity: parseInt(current.humidity) || 60,
          advice: getWeatherAdvice(temp, desc),
          icon: getWeatherIcon(desc, temp),
        };
      }
    }
  } catch (e) {
    console.warn('[Weather] wttr.in 请求失败，将使用默认天气');
  }

  const temp = 24;
  return {
    city: resolvedCity,
    temp,
    tempRange: '20° ~ 27°',
    condition: '多云',
    humidity: 55,
    advice: '当前使用默认天气建议，出行前可再刷新确认',
    icon: '⛅️',
  };
}

export function assessWeatherImpact(
  activities: Activity[],
  weather: WeatherInfo
): WeatherImpactAssessment {
  const risks: string[] = [];
  const recommendations: string[] = [];
  const autoAdjustments: WeatherImpactAssessment['autoAdjustments'] = [];

  const badWeather = /雨|雪|雷|雾|霾|沙尘/.test(weather.condition);
  const extremeTemp = weather.temp < 5 || weather.temp > 35;

  const outdoorKeywords = [
    '公园',
    '户外',
    '江边',
    '沙滩',
    '游乐园',
    '动物园',
    '景点',
    '徒步',
    '爬山',
  ];
  const indoorKeywords = ['室内', '博物馆', '商场', '餐厅', '咖啡', '展览', '剧院', '电影院'];

  for (const activity of activities) {
    const isOutdoor =
      !activity.tags.some((tag) => indoorKeywords.some((keyword) => tag.includes(keyword))) &&
      (outdoorKeywords.some((keyword) => activity.title.includes(keyword)) ||
        outdoorKeywords.some((keyword) => activity.tags.some((tag) => tag.includes(keyword))));

    if (badWeather && isOutdoor) {
      risks.push(`${activity.title} 是户外活动，天气不佳可能有影响`);
      autoAdjustments.push({
        activityId: activity.id,
        action: 'add_indoor',
        reason: '天气不佳，户外活动体验差',
        suggestion: '建议附近室内场馆替代',
      });
    }
  }

  if (extremeTemp) {
    if (weather.temp > 35) {
      risks.push('高温天气，长时间户外容易中暑');
      recommendations.push('增加室内活动比例，多补充水分');
    } else if (weather.temp < 5) {
      risks.push('低温天气，户外体感寒冷');
      recommendations.push('选择室内为主，或准备保暖装备');
    }
  }

  if (/雨|雪/.test(weather.condition)) {
    risks.push('雨雪天气路面湿滑');
    recommendations.push('减少户外步行，选择打车出行');
    autoAdjustments.push({
      activityId: '',
      action: 'replace',
      reason: '雨雪天气不适合户外长时间停留',
      suggestion: '优先选择室内场馆或餐厅',
    });
  }

  let level: WeatherImpactAssessment['level'] = 'none';
  if (autoAdjustments.length >= 3 || extremeTemp) {
    level = 'high';
  } else if (autoAdjustments.length >= 1 || badWeather) {
    level = 'medium';
  } else if (badWeather || extremeTemp) {
    level = 'low';
  }

  return { level, risks, recommendations, autoAdjustments };
}
