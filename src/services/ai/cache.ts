import { searchSmartNearby } from '../apiAdapter';
import { LRUCache } from '../../utils/lruCache';

type POICacheItem = {
  id?: string;
  name: string;
  type: string;
  address?: string;
  distance?: string;
  rating?: string;
  cost?: string;
  photos?: string[];
  businessArea?: string;
  openTime?: string;
  phone?: string;
};

export const poiCache = new LRUCache<POICacheItem[]>(1000);

export async function cachedSearchPOI(
  keywords: string,
  city: string,
  radius?: number,
  type?: string
): Promise<POICacheItem[]> {
  const cacheKey = `${keywords}|${city}|${radius || ''}|${type || ''}`;

  // [PERF-OPT] Check cache first
  if (poiCache.has(cacheKey)) {
    return poiCache.get(cacheKey)!;
  }

  // [PERF-OPT] Cache miss - call API
  const result = await searchSmartNearby(keywords, city, radius, type);

  // [PERF-OPT] Store in cache
  poiCache.set(cacheKey, result);

  return result;
}
