import { readRuntimeEnv } from './runtimeEnv';
import { searchSmartNearby, fetchPOIDetail } from './apiAdapter';
import { dataSource } from './apiAdapter';

const AMAP_KEY = readRuntimeEnv('VITE_AMAP_KEY') || readRuntimeEnv('AMAP_KEY');
const AMAP_USE_PROXY =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_AMAP_USE_PROXY !== 'false';
const AMAP_PROXY_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AMAP_PROXY_HOST) || '/api/amap';
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';

const imageCache = new Map<string, string>();
const DETAIL_CONCURRENCY = 2;
const DETAIL_DELAY_MS = 600;

function buildStaticMapUrl(lng: number, lat: number, name: string): string {
  const markers = `mid,0xFF6B35,A:${lng},${lat}`;
  const params = `location=${lng},${lat}&zoom=15&size=400*300&markers=${markers}&scale=2`;
  if (AMAP_USE_PROXY) {
    return `${API_BASE_URL}${AMAP_PROXY_HOST}?path=${encodeURIComponent(`staticmap?${params}`)}`;
  }
  return `https://restapi.amap.com/v3/staticmap?${params}&key=${AMAP_KEY}`;
}

function buildAmapImageUrl(originalUrl: string): string {
  if (AMAP_USE_PROXY) {
    return `${API_BASE_URL}/api/amap-image?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
}

function normalizePhotos(photos?: string[]): string[] {
  if (!photos || photos.length === 0) return [];
  return photos.filter((p) => p && p.startsWith('http'));
}

async function tryDetailPhoto(poiId: string): Promise<string | null> {
  try {
    const detail = await fetchPOIDetail(poiId);
    if (detail?.photos && detail.photos.length > 0) {
      return buildAmapImageUrl(detail.photos[0].url);
    }
  } catch {}
  return null;
}

export async function fetchPOIImage(
  poiName: string,
  city?: string,
  location?: { lng: number; lat: number },
  existingPhotos?: string[],
  poiId?: string
): Promise<string | null> {
  const cacheKey = poiId ? `id:${poiId}` : `${poiName}_${city || ''}`;
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const photos = normalizePhotos(existingPhotos);
  if (photos.length > 0) {
    const proxied = buildAmapImageUrl(photos[0]);
    imageCache.set(cacheKey, proxied);
    return proxied;
  }

  if (poiId) {
    const detailPhoto = await tryDetailPhoto(poiId);
    if (detailPhoto) {
      imageCache.set(cacheKey, detailPhoto);
      return detailPhoto;
    }
  }

  if (!dataSource.hasAmap || !city) {
    if (location) {
      const staticUrl = buildStaticMapUrl(location.lng, location.lat, poiName);
      imageCache.set(cacheKey, staticUrl);
      return staticUrl;
    }
    return null;
  }

  try {
    const pois = await searchSmartNearby(poiName, city, 3000);
    const matched = pois.find(
      (p) => p.name === poiName || poiName.includes(p.name) || p.name.includes(poiName)
    );
    const target = matched || pois[0];

    if (target?.photos && target.photos.length > 0) {
      const proxied = buildAmapImageUrl(target.photos[0]);
      imageCache.set(cacheKey, proxied);
      return proxied;
    }

    if (target?.id) {
      const detailPhoto = await tryDetailPhoto(target.id);
      if (detailPhoto) {
        imageCache.set(cacheKey, detailPhoto);
        return detailPhoto;
      }
    }

    const loc = target?.location || location;
    if (loc) {
      const staticUrl = buildStaticMapUrl(loc.lng, loc.lat, target?.name || poiName);
      imageCache.set(cacheKey, staticUrl);
      return staticUrl;
    }
  } catch (err) {
    console.warn('[poiImageService] Failed to fetch POI image:', err);
    if (location) {
      const staticUrl = buildStaticMapUrl(location.lng, location.lat, poiName);
      imageCache.set(cacheKey, staticUrl);
      return staticUrl;
    }
  }

  return null;
}

export async function batchFetchPOIImages(
  items: Array<{
    name: string;
    city?: string;
    location?: { lng: number; lat: number };
    photos?: string[];
    poiId?: string;
  }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uncached: typeof items = [];

  for (const item of items) {
    const cacheKey = item.poiId ? `id:${item.poiId}` : `${item.name}_${item.city || ''}`;
    const cached = imageCache.get(cacheKey);
    if (cached) {
      results.set(item.name, cached);
    } else {
      uncached.push(item);
    }
  }

  if (uncached.length === 0) return results;

  for (let i = 0; i < uncached.length; i += DETAIL_CONCURRENCY) {
    const batch = uncached.slice(i, i + DETAIL_CONCURRENCY);
    const promises = batch.map(async (item) => {
      const url = await fetchPOIImage(item.name, item.city, item.location, item.photos, item.poiId);
      if (url) {
        results.set(item.name, url);
      }
    });
    await Promise.allSettled(promises);
    if (i + DETAIL_CONCURRENCY < uncached.length) {
      await new Promise((r) => setTimeout(r, DETAIL_DELAY_MS));
    }
  }

  return results;
}
