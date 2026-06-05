export const POI_CACHE_TTL_MS = 30 * 60 * 1000;
export const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
export const PREFERENCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export class CacheLayer<T = unknown> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(
    private storageKey?: string,
    maxSize: number = 500
  ) {
    this.maxSize = maxSize;
    if (storageKey && getStorage()) {
      this.loadFromStorage();
    }
  }

  get(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttl: number = POI_CACHE_TTL_MS): void {
    // LRU eviction: remove oldest entry if at capacity
    if (this.memoryCache.size >= this.maxSize && !this.memoryCache.has(key)) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    if (this.storageKey && getStorage()) {
      this.saveToStorage();
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key?: string): void {
    if (key) {
      this.memoryCache.delete(key);
    } else {
      this.memoryCache.clear();
    }
    if (this.storageKey && getStorage()) {
      this.saveToStorage();
    }
  }

  buildKey(...parts: string[]): string {
    return parts.filter(Boolean).join('::');
  }

  private loadFromStorage(): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      const raw = storage.getItem(this.storageKey!);
      if (!raw) return;
      const entries: Array<{ key: string; entry: CacheEntry<T> }> = JSON.parse(raw);
      for (const { key, entry } of entries) {
        if (Date.now() - entry.timestamp <= entry.ttl) {
          this.memoryCache.set(key, entry);
        }
      }
    } catch {
      // parse error, silently skip
    }
  }

  private saveToStorage(): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      const entries = Array.from(this.memoryCache.entries()).map(([key, entry]) => ({
        key,
        entry,
      }));
      storage.setItem(this.storageKey!, JSON.stringify(entries));
    } catch {
      // storage full or unavailable, silently fail
    }
  }
}

export const poiCache = new CacheLayer('meituan_ai_poi_cache');
export const weatherCache = new CacheLayer('meituan_ai_weather_cache');
export const locationCache = new CacheLayer('meituan_ai_location_cache');
