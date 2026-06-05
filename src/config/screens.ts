import type { ComponentType } from 'react';

export interface ScreenConfig {
  id: string;
  showNavBar?: boolean;
}

export const SCREEN_REGISTRY: Record<string, ScreenConfig> = {
  home: { id: 'home', showNavBar: false },
  planning: { id: 'planning', showNavBar: false },
  overview: { id: 'overview', showNavBar: false },
  itinerary: { id: 'itinerary', showNavBar: false },
  detail: { id: 'detail', showNavBar: true },
  booking: { id: 'booking', showNavBar: true },
  payment: { id: 'payment', showNavBar: true },
  success: { id: 'success', showNavBar: false },
  share: { id: 'share', showNavBar: true },
  adjust: { id: 'adjust', showNavBar: true },
  backups: { id: 'backups', showNavBar: true },
  explore: { id: 'explore', showNavBar: false },
  explore_detail: { id: 'explore_detail', showNavBar: true },
  orders: { id: 'orders', showNavBar: true },
  profile: { id: 'profile', showNavBar: true },
  record: { id: 'record', showNavBar: true },
  story: { id: 'story', showNavBar: false },
  memories: { id: 'memories', showNavBar: false },
  restaurant_finder: { id: 'restaurant_finder', showNavBar: false },
  service_finder: { id: 'service_finder', showNavBar: false },
  taxi_finder: { id: 'taxi_finder', showNavBar: false },
  budget_records: { id: 'budget_records', showNavBar: false },
};

export const SCREEN_IDS = Object.keys(SCREEN_REGISTRY) as ScreenId[];

export type ScreenId = keyof typeof SCREEN_REGISTRY;
