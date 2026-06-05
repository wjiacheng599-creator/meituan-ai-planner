import type { TravelMode } from '../types';
import { Bike, Car, Footprints, CarTaxiFront, Train } from 'lucide-react';

export interface TravelModePlugin {
  id: TravelMode;
  label: string;
  shortLabel: string;
  icon: typeof Car;
  color: string;
  bg: string;
  softText: string;
  border: string;

  supportsRoutePlanning: boolean;
  supportsRealTimeUpdates: boolean;

  estimateDuration?: (distance: number) => number;
  estimateCost?: (distance: number, duration: number) => number;

  apiType: 'AMap.Driving' | 'AMap.Transfer' | 'AMap.Walking' | 'AMap.Riding';
  description: string;
  lineStyle: 'solid' | 'dashed';
  strokeWeight: number;
}

export const TRAVEL_MODE_PLUGINS: TravelModePlugin[] = [
  {
    id: 'driving',
    label: '驾车',
    shortLabel: '驾车',
    icon: Car,
    color: '#3b82f6',
    bg: '#dbeafe',
    softText: '#1d4ed8',
    border: '#93c5fd',
    supportsRoutePlanning: true,
    supportsRealTimeUpdates: true,
    estimateDuration: (distance) => Math.ceil(distance / 30),
    estimateCost: (distance) => Math.round(distance * 2.5),
    apiType: 'AMap.Driving',
    description: '最短时间路线规划，实时路况导航',
    lineStyle: 'solid',
    strokeWeight: 6,
  },
  {
    id: 'taxi',
    label: '打车',
    shortLabel: '打车',
    icon: CarTaxiFront,
    color: '#f59e0b',
    bg: '#fef3c7',
    softText: '#b45309',
    border: '#fcd34d',
    supportsRoutePlanning: true,
    supportsRealTimeUpdates: true,
    estimateCost: (distance, duration) => Math.round(distance * 3 + duration * 0.5),
    apiType: 'AMap.Driving',
    description: '预估打车费用，快速到达目的地',
    lineStyle: 'solid',
    strokeWeight: 6,
  },
  {
    id: 'transit',
    label: '地铁',
    shortLabel: '地铁',
    icon: Train,
    color: '#f97316',
    bg: '#ffedd5',
    softText: '#c2410c',
    border: '#fdba74',
    supportsRoutePlanning: true,
    supportsRealTimeUpdates: true,
    estimateCost: () => 4,
    apiType: 'AMap.Transfer',
    description: '公交/地铁换乘方案，步行+乘车指引',
    lineStyle: 'dashed',
    strokeWeight: 5,
  },
  {
    id: 'cycling',
    label: '骑行',
    shortLabel: '骑行',
    icon: Bike,
    color: '#22c55e',
    bg: '#dcfce7',
    softText: '#15803d',
    border: '#86efac',
    supportsRoutePlanning: true,
    supportsRealTimeUpdates: false,
    estimateDuration: (distance) => Math.ceil(distance / 15),
    apiType: 'AMap.Riding',
    description: '骑行路线推荐，适合近距离出行',
    lineStyle: 'solid',
    strokeWeight: 5,
  },
  {
    id: 'walking',
    label: '步行',
    shortLabel: '步行',
    icon: Footprints,
    color: '#6b7280',
    bg: '#f3f4f6',
    softText: '#4b5563',
    border: '#d1d5db',
    supportsRoutePlanning: true,
    supportsRealTimeUpdates: false,
    estimateDuration: (distance) => Math.ceil(distance / 4),
    apiType: 'AMap.Walking',
    description: '步行导航，详细转向指引',
    lineStyle: 'dashed',
    strokeWeight: 4,
  },
];

export const getTravelModePlugin = (mode: TravelMode): TravelModePlugin => {
  return TRAVEL_MODE_PLUGINS.find((p) => p.id === mode)!;
};

export const registerTravelModePlugin = (plugin: TravelModePlugin): void => {
  const existingIndex = TRAVEL_MODE_PLUGINS.findIndex((p) => p.id === plugin.id);
  if (existingIndex >= 0) {
    TRAVEL_MODE_PLUGINS[existingIndex] = plugin;
  } else {
    TRAVEL_MODE_PLUGINS.push(plugin);
  }
};

export const TRAVEL_MODE_META = TRAVEL_MODE_PLUGINS.reduce(
  (acc, plugin) => {
    acc[plugin.id] = {
      label: plugin.label,
      shortLabel: plugin.shortLabel,
      icon: plugin.icon,
      color: plugin.color,
      bg: plugin.bg,
      softText: plugin.softText,
      border: plugin.border,
      description: plugin.description,
      lineStyle: plugin.lineStyle,
      strokeWeight: plugin.strokeWeight,
    };
    return acc;
  },
  {} as Record<
    TravelMode,
    {
      label: string;
      shortLabel: string;
      icon: typeof Car;
      color: string;
      bg: string;
      softText: string;
      border: string;
      description: string;
      lineStyle: 'solid' | 'dashed';
      strokeWeight: number;
    }
  >
);

export const TRAVEL_MODE_ORDER: TravelMode[] = ['driving', 'taxi', 'transit', 'cycling', 'walking'];
