export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: 'restaurant' | 'attraction' | 'hotel' | 'activity';
  city: string;
  tags: string[];
  rating?: number;
  price?: number;
  openingHours?: string;
  address?: string;
  relevanceScore?: number;
  embedding?: number[];
}

interface IndexEntry {
  item: KnowledgeItem;
  keywords: Set<string>;
  category: string;
  city: string;
}

export class KnowledgeBase {
  private index: Map<string, IndexEntry> = new Map();
  private categoryIndex: Map<string, KnowledgeItem[]> = new Map();
  private cityIndex: Map<string, KnowledgeItem[]> = new Map();

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[，,。\s、！!?？（）()\[\]{}""''：:]+/)
      .filter(token => token.length > 1);
  }

  private extractKeywords(item: KnowledgeItem): Set<string> {
    const keywords = new Set<string>();
    
    const titleTokens = this.tokenize(item.title);
    titleTokens.forEach(t => keywords.add(t));

    const contentTokens = this.tokenize(item.content);
    contentTokens.forEach(t => keywords.add(t));

    item.tags.forEach(tag => {
      const tagTokens = this.tokenize(tag);
      tagTokens.forEach(t => keywords.add(t));
    });

    return keywords;
  }

  async addItem(item: Omit<KnowledgeItem, 'relevanceScore'>): Promise<void> {
    const fullItem: KnowledgeItem = { ...item, relevanceScore: 0 };
    const keywords = this.extractKeywords(fullItem);
    
    this.index.set(item.id, {
      item: fullItem,
      keywords,
      category: item.category,
      city: item.city,
    });

    if (!this.categoryIndex.has(item.category)) {
      this.categoryIndex.set(item.category, []);
    }
    this.categoryIndex.get(item.category)!.push(fullItem);

    if (!this.cityIndex.has(item.city)) {
      this.cityIndex.set(item.city, []);
    }
    const cityItems = this.cityIndex.get(item.city)!;
    if (!cityItems.find(i => i.id === item.id)) {
      cityItems.push(fullItem);
    }
  }

  async addItems(items: Array<Omit<KnowledgeItem, 'relevanceScore'>>): Promise<void> {
    for (const item of items) {
      await this.addItem(item);
    }
  }

  async search(query: string, city?: string, limit: number = 5): Promise<KnowledgeItem[]> {
    const queryTokens = this.tokenize(query);
    const results: KnowledgeItem[] = [];

    const searchInCategory = (category: string) => {
      const items = this.categoryIndex.get(category) || [];
      for (const item of items) {
        if (city && item.city !== city) continue;
        
        let score = 0;
        const entry = this.index.get(item.id);
        if (entry) {
          for (const queryToken of queryTokens) {
            if (entry.keywords.has(queryToken)) {
              score += 1;
            }
          }
        }
        
        if (score > 0) {
          item.relevanceScore = score;
          results.push(item);
        }
      }
    };

    searchInCategory('restaurant');
    searchInCategory('attraction');
    searchInCategory('activity');
    searchInCategory('hotel');

    return results
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, limit);
  }

  async searchByCategory(category: string, city?: string, limit: number = 10): Promise<KnowledgeItem[]> {
    const items = this.categoryIndex.get(category) || [];
    const filtered = city 
      ? items.filter(item => item.city === city)
      : items;
    return filtered.slice(0, limit);
  }

  async getById(id: string): Promise<KnowledgeItem | undefined> {
    const entry = this.index.get(id);
    return entry?.item;
  }

  async getStats(): Promise<{ total: number; byCategory: Record<string, number>; byCity: Record<string, number> }> {
    const byCategory: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    
    for (const [category, items] of this.categoryIndex.entries()) {
      byCategory[category] = items.length;
    }
    
    for (const [city, items] of this.cityIndex.entries()) {
      byCity[city] = items.length;
    }
    
    return {
      total: this.index.size,
      byCategory,
      byCity,
    };
  }

  async clear(): Promise<void> {
    this.index.clear();
    this.categoryIndex.clear();
    this.cityIndex.clear();
  }
}

export const globalKnowledgeBase = new KnowledgeBase();

export async function initializeKnowledgeBase(): Promise<void> {
  // 知识库种子数据已移除 — POI 数据由高德 API 实时提供
  // 用户偏好由 travelDNA + userPreference + 行为事件系统处理
  console.log('[KnowledgeBase] Initialized (no seed data — using AMap API + user preferences)');
}
