import type { ServerRepository } from './repository/types';

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

const DEFAULT_PREFS: Omit<UserPreference, 'userId' | 'lastUpdated'> = {
  favoriteCategories: [],
  avoidCategories: [],
  priceRange: { min: 0, max: 1000 },
  preferredTime: 'any',
  dietaryRestrictions: [],
  recentSearches: [],
};

export class UserPreferenceManager {
  private repository: ServerRepository;

  constructor(repository: ServerRepository) {
    this.repository = repository;
  }

  async getPreferences(userId: string): Promise<UserPreference> {
    const stored = await this.repository.getUserPreferences(userId);
    if (stored) {
      return {
        userId,
        ...stored,
        preferredTime: stored.preferredTime as UserPreference['preferredTime'],
        lastUpdated: Date.now(),
      };
    }
    return {
      userId,
      ...DEFAULT_PREFS,
      lastUpdated: Date.now(),
    };
  }

  async updatePreferences(userId: string, updates: Partial<UserPreference>): Promise<UserPreference> {
    await this.repository.upsertUserPreferences(userId, updates);
    return this.getPreferences(userId);
  }

  async trackSearch(userId: string, query: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    const newSearches = [
      query,
      ...prefs.recentSearches.filter(s => s !== query)
    ].slice(0, 10);
    await this.updatePreferences(userId, { recentSearches: newSearches });
  }

  async addFavoriteCategory(userId: string, category: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs.favoriteCategories.includes(category)) {
      await this.updatePreferences(userId, {
        favoriteCategories: [...prefs.favoriteCategories, category],
      });
    }
  }

  async removeFavoriteCategory(userId: string, category: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    await this.updatePreferences(userId, {
      favoriteCategories: prefs.favoriteCategories.filter(c => c !== category),
    });
  }

  async setPriceRange(userId: string, min: number, max: number): Promise<void> {
    await this.updatePreferences(userId, {
      priceRange: { min, max },
    });
  }

  async addDietaryRestriction(userId: string, restriction: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs.dietaryRestrictions.includes(restriction)) {
      await this.updatePreferences(userId, {
        dietaryRestrictions: [...prefs.dietaryRestrictions, restriction],
      });
    }
  }

  async setPreferredTime(userId: string, time: UserPreference['preferredTime']): Promise<void> {
    await this.updatePreferences(userId, { preferredTime: time });
  }

  async learnFromActivity(userId: string, activity: { title: string; tags: string[]; price: number }): Promise<void> {
    const prefs = await this.getPreferences(userId);

    // 从活动标签中学习偏好
    for (const tag of activity.tags) {
      if (tag && !prefs.favoriteCategories.includes(tag)) {
        const categoryCount = prefs.recentSearches.filter(s => s.includes(tag)).length;
        if (categoryCount >= 2) {
          await this.addFavoriteCategory(userId, tag);
        }
      }
    }

    // 记录搜索历史
    if (activity.title) {
      await this.trackSearch(userId, activity.title);
    }

    // 更新价格范围
    if (activity.price > 0) {
      const currentMax = prefs.priceRange.max;
      if (activity.price > currentMax) {
        await this.updatePreferences(userId, {
          priceRange: { min: prefs.priceRange.min, max: activity.price },
        });
      }
    }
  }

  async clearPreferences(userId: string): Promise<void> {
    await this.repository.upsertUserPreferences(userId, DEFAULT_PREFS);
  }

  async exportPreferences(userId: string): Promise<UserPreference | null> {
    return this.getPreferences(userId);
  }

  async importPreferences(prefs: UserPreference): Promise<void> {
    await this.repository.upsertUserPreferences(prefs.userId, prefs);
  }
}
