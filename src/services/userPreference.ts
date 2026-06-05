import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TravelMode } from '../types';

const STORAGE_KEY = 'meituan_ai_travel_mode';

export interface UserPreference {
  userId: string;
  favoriteCategories: string[];
  avoidCategories: string[];
  priceRange: { min: number; max: number };
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
  dietaryRestrictions: string[];
  recentSearches: string[];
  lastUpdated: number;
}

interface UserPreferenceState {
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  favoriteCategories: string[];
  setFavoriteCategories: (categories: string[]) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

export const useUserPreferenceStore = create<UserPreferenceState>()(
  persist(
    (set, get) => ({
      travelMode: 'driving',
      setTravelMode: (mode) => set({ travelMode: mode }),
      favoriteCategories: [],
      setFavoriteCategories: (categories) => set({ favoriteCategories: categories }),
      recentSearches: [],
      addRecentSearch: (query) => {
        const current = get().recentSearches;
        const filtered = current.filter((q) => q !== query);
        const updated = [query, ...filtered].slice(0, 10);
        set({ recentSearches: updated });
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'meituan-ai-user-preferences',
      partialize: (state) => ({
        travelMode: state.travelMode,
        favoriteCategories: state.favoriteCategories,
        recentSearches: state.recentSearches,
      }),
    }
  )
);

export function useTravelMode() {
  const { travelMode, setTravelMode } = useUserPreferenceStore();
  return { travelMode, setTravelMode };
}

export async function getUserPreferences(): Promise<UserPreference | null> {
  try {
    const response = await fetch('/api/preferences', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.preferences || null;
  } catch (error) {
    console.error('[Preferences] Failed to get preferences:', error);
    return null;
  }
}

export async function updateUserPreferences(updates: Partial<UserPreference>): Promise<boolean> {
  try {
    const response = await fetch('/api/preferences', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return response.ok;
  } catch (error) {
    console.error('[Preferences] Failed to update preferences:', error);
    return false;
  }
}

export async function trackSearchQuery(query: string): Promise<void> {
  try {
    // 复用 learn 端点，search 也是一种学习行为
    await fetch('/api/preferences/learn', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: query, context: 'search' }),
    });
  } catch (error) {
    console.error('[Preferences] Failed to track search:', error);
  }
}

export async function learnFromActivity(activity: {
  title: string;
  tags: string[];
  price: number;
}): Promise<void> {
  try {
    await fetch('/api/preferences/learn', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: activity.title,
        context: activity.tags.join(','),
        price: activity.price,
      }),
    });
  } catch (error) {
    console.error('[Preferences] Failed to learn from activity:', error);
  }
}
