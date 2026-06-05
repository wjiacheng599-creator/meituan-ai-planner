import { readRuntimeEnv } from './runtimeEnv';
import { apiUrl } from "./apiBase";

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
}

export async function searchKnowledge(
  query: string,
  city?: string,
  limit: number = 5
): Promise<KnowledgeItem[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      ...(city ? { city } : {}),
      limit: String(limit),
    });
    const response = await fetch(`${API_BASE}/api/knowledge/search?${params}`);

    if (!response.ok) {
      console.error('[Knowledge] Search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[Knowledge] Search error:', error);
    return [];
  }
}

export async function retrieveKnowledgeContext(
  query: string,
  city: string,
  activityContext?: string
): Promise<string> {
  try {
    const searchQuery = `${query} ${activityContext || ''}`;
    const items = await searchKnowledge(searchQuery, city, 3);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return '';
    }

    const formattedItems = items
      .map((item, i) => {
        const ratingStr = item.rating ? `评分 ${item.rating}星` : '';
        const priceStr = item.price ? `人均 ¥${item.price}` : '';
        const hoursStr = item.openingHours ? `营业时间: ${item.openingHours}` : '';
        const addressStr = item.address ? `地址: ${item.address}` : '';

        return `${i + 1}. [${item.category}] ${item.title}
         ${item.content.slice(0, 100)}...
         ${[ratingStr, priceStr, hoursStr, addressStr].filter(Boolean).join(' | ')}`;
      })
      .join('\n\n');

    return `知识库检索结果：\n${formattedItems}`;
  } catch (error) {
    console.error('[Knowledge] Context retrieval error:', error);
    return '';
  }
}
