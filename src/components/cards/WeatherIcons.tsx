import React, { memo } from 'react';

import clearDayRaw from '@meteocons/svg/fill/clear-day.svg?raw';
import partlyCloudyDayRaw from '@meteocons/svg/fill/partly-cloudy-day.svg?raw';
import overcastRaw from '@meteocons/svg/fill/overcast.svg?raw';
import rainRaw from '@meteocons/svg/fill/rain.svg?raw';
import drizzleRaw from '@meteocons/svg/fill/drizzle.svg?raw';
import thunderstormsRaw from '@meteocons/svg/fill/thunderstorms.svg?raw';
import snowRaw from '@meteocons/svg/fill/snow.svg?raw';
import fogRaw from '@meteocons/svg/fill/fog.svg?raw';

export type WeatherIconName =
  | 'clear-day'
  | 'partly-cloudy-day'
  | 'overcast'
  | 'rain'
  | 'drizzle'
  | 'thunderstorms'
  | 'snow'
  | 'fog';

const weatherIconMap: Record<WeatherIconName, string> = {
  'clear-day': clearDayRaw,
  'partly-cloudy-day': partlyCloudyDayRaw,
  overcast: overcastRaw,
  rain: rainRaw,
  drizzle: drizzleRaw,
  thunderstorms: thunderstormsRaw,
  snow: snowRaw,
  fog: fogRaw,
};

export function mapWeatherCondition(condition: string): WeatherIconName {
  if (condition.includes('晴')) return 'clear-day';
  if (condition.includes('多云')) return 'partly-cloudy-day';
  if (condition.includes('阴')) return 'overcast';
  if (condition.includes('雷')) return 'thunderstorms';
  if (condition.includes('小雨') || condition.includes('毛毛雨')) return 'drizzle';
  if (condition.includes('雨')) return 'rain';
  if (condition.includes('雪')) return 'snow';
  if (condition.includes('雾') || condition.includes('霾')) return 'fog';
  return 'clear-day';
}

interface WeatherIconProps {
  condition: string;
  size?: number;
  className?: string;
}

export const WeatherIcon = memo(function WeatherIcon({
  condition,
  size = 80,
  className = '',
}: WeatherIconProps) {
  const iconName = mapWeatherCondition(condition);
  const svgRaw = weatherIconMap[iconName];

  // 替换 SVG 中的宽度和高度属性，或者直接设置样式
  const sizedSvg = svgRaw.replace(/<svg([\s\S]*?)>/, `<svg width="${size}" height="${size}" $1>`);

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: sizedSvg }}
    />
  );
});
