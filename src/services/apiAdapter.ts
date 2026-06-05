import { readRuntimeEnv } from './runtimeEnv';
import { poiCache, POI_CACHE_TTL_MS } from '../utils/cache';
import type { TaxiDispatchRecommendation, TravelMode } from '../types';
import { convertGpsToAmap } from './amapWeb';

const AMAP_KEY = readRuntimeEnv('VITE_AMAP_KEY') || readRuntimeEnv('AMAP_KEY');

const isDev =
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV);

export const dataSource = {
  get hasAmap() {
    return !!AMAP_KEY || AMAP_USE_PROXY;
  },
  get hasMeituan() {
    return false;
  },
  get label() {
    if (this.hasAmap) return '实时数据';
    return '智能整理';
  },
  get sublabel() {
    if (this.hasAmap) return '高德地图 · 真实POI';
    return '本地推荐整理';
  },
};

export interface POIResult {
  id?: string;
  name: string;
  address: string;
  phone: string;
  rating: string;
  cost: string;
  location: { lng: number; lat: number };
  type: string;
  distance: string;
  poiId?: string;
  photos?: string[];
  businessArea?: string;
  openTime?: string;
}

function emptyPoiResults(): POIResult[] {
  return [];
}

export interface RouteResult {
  distance: number;
  duration: number;
  mode: string;
  steps: string[];
  polyline?: string;
  cost?: number;
  transfers?: number;
  walkingDistance?: number;
  taxi?: TaxiDispatchRecommendation;
  /** 导航指示（AMap 公交/驾车结果中有此字段） */
  instruction?: string;
  /** 公交详途信息 */
  transitDetails?: Array<{
    lineName: string;
    lineType: string;
    stationCount: number;
    startStation: string;
    endStation: string;
    viaStations?: string[];
  }>;
}

export interface MeituanShopResult {
  name: string;
  avgPrice: number;
  rating: number;
  address: string;
  phone: string;
  openTime: string;
  hasQueue: boolean;
  estimatedWait: number;
}

const AMAP_API_TIMEOUT_MS = 5000;
const GEOLOCATION_TIMEOUT_MS = 10000;
const GEOLOCATION_MAX_AGE_MS = 300000;
const IPINFO_TIMEOUT_MS = 4000;
const DEFAULT_SEARCH_RADIUS = 3000;
const MAX_POI_RESULTS = 20;
const MAX_INPUT_TIPS = 8;
const MAX_DRIVING_STEPS = 3;
const MAX_BICYCLE_STEPS = 5;

const AMAP_USE_PROXY =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_AMAP_USE_PROXY !== 'false';
const AMAP_PROXY_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AMAP_PROXY_HOST) || '/api/amap';
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
const MAX_RETRY_COUNT = 2;
const RETRY_DELAY_MS = 500;

interface FetchError {
  code: string;
  message: string;
}

export const amapErrors = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  API_ERROR: 'API_ERROR',
  NO_KEY: 'NO_KEY',
} as const;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function amapFetch<T>(url: string, retryCount = 0): Promise<T | null> {
  if (!AMAP_KEY && !AMAP_USE_PROXY) {
    if (isDev) console.warn('[amapFetch] No AMAP_KEY configured');
    return null;
  }

  try {
    let fetchUrl: string;
    if (AMAP_USE_PROXY) {
      const pathPart = url.split('restapi.amap.com')[1] || '';
      fetchUrl = `${API_BASE_URL || ''}${AMAP_PROXY_HOST}?path=${encodeURIComponent(pathPart)}`;
    } else {
      fetchUrl = `${url}${url.includes('?') ? '&' : '?'}key=${AMAP_KEY}`;
    }

    const fetchOptions: RequestInit = {
      signal: AbortSignal.timeout(AMAP_API_TIMEOUT_MS),
    };

    if (AMAP_USE_PROXY) {
      fetchOptions.method = 'GET';
    }

    const actualFetchUrl = AMAP_USE_PROXY
      ? fetchUrl
      : `${url}${url.includes('?') ? '&' : '?'}key=${AMAP_KEY}`;
    const res = await fetch(actualFetchUrl, fetchOptions);

    if (!res.ok) {
      if (isDev) console.error('[amapFetch] HTTP error:', res.status, res.statusText);
      return null;
    }

    const data = await res.json();

    const isV3Success = data.status === '1';
    const isLegacySuccess = data.errcode === 10001 || data.errcode === 0;
    const isV4DirectionSuccess =
      !!data.data && (Array.isArray(data.data.paths) || Array.isArray(data.data.routes));

    if (!isV3Success && !isLegacySuccess && !isV4DirectionSuccess) {
      if (isDev) console.warn('[amapFetch] API returned error:', data.info);
      return null;
    }
    return data as T;
  } catch (error) {
    if (isDev) {
      console.error(
        `[amapFetch] Request failed (attempt ${retryCount + 1}):`,
        error instanceof Error ? error.message : error
      );
    }

    if (retryCount < MAX_RETRY_COUNT) {
      const exponentialDelay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      const jitter = Math.random() * 100;
      await delay(exponentialDelay + jitter);
      return amapFetch<T>(url, retryCount + 1);
    }

    return null;
  }
}

interface AmapPoiItem {
  id: string;
  name: string;
  address: string;
  tel: string;
  location: string;
  type: string;
  distance: string;
  biz_ext?: { rating?: string; cost?: string; opentime2?: string }[];
  photos?: Array<{ title?: string; url?: string }>;
  business_area?: string;
}

interface AmapPoiResponse {
  pois: AmapPoiItem[];
}

let cachedUserLocation: { lng: number; lat: number } | null = null;
let locationPromise: Promise<{ lng: number; lat: number } | null> | null = null;
let cachedUserCity: string | null = null;
let cityPromise: Promise<string> | null = null;

const MANUAL_CITY_KEY = 'user_manual_city';

function normalizeCityName(city?: string | null): string {
  return (city || '')
    .replace(/特别行政区|自治区|自治州/g, '')
    .replace(/[省市区县盟地区]+/g, '')
    .trim();
}

function isSameCityName(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeCityName(left);
  const normalizedRight = normalizeCityName(right);

  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

export function getManualCity(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(MANUAL_CITY_KEY);
}

export function setManualCity(city: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(MANUAL_CITY_KEY, city);
  cachedUserCity = city;
  cityPromise = Promise.resolve(city);
}

export function clearManualCity(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(MANUAL_CITY_KEY);
  cachedUserCity = null;
  cityPromise = null;
}

function getBrowserGeolocation(): Promise<{ lng: number; lat: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      (err) => {
        if (isDev) console.warn('[getBrowserGeolocation] 定位失败:', err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: GEOLOCATION_MAX_AGE_MS,
      }
    );
  });
}

export async function getUserLocation(): Promise<{ lng: number; lat: number } | null> {
  if (cachedUserLocation) return cachedUserLocation;
  if (locationPromise) return locationPromise;

  locationPromise = (async () => {
    const browserLoc = await getBrowserGeolocation();
    if (browserLoc) {
      const convertedBrowserLoc = await convertGpsToAmap(browserLoc);
      cachedUserLocation = convertedBrowserLoc;
      return convertedBrowserLoc;
    }

    try {
      const data = await amapFetch<{ rectangle: string }>(
        'https://restapi.amap.com/v3/ip?extensions=base'
      );
      if (data?.rectangle) {
        const parts = data.rectangle.split(';');
        if (parts.length >= 2) {
          const [lng1, lat1] = parts[0].split(',').map(Number);
          const [lng2, lat2] = parts[1].split(',').map(Number);
          if (lng1 && lat1 && lng2 && lat2) {
            cachedUserLocation = { lng: (lng1 + lng2) / 2, lat: (lat1 + lat2) / 2 };
            return cachedUserLocation;
          }
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const resp = await fetch('https://ipinfo.io/json', {
        signal: AbortSignal.timeout(IPINFO_TIMEOUT_MS),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.loc) {
          const [lat, lng] = data.loc.split(',').map(Number);
          if (isNaN(lng) || isNaN(lat)) {
            console.warn('[getUserLocation] ipinfo returned invalid coordinates:', data.loc);
          } else {
            cachedUserCity = data.city || null;
            cachedUserLocation = { lng, lat };
            return cachedUserLocation;
          }
        }
      }
    } catch {
      /* ignore */
    }

    locationPromise = null;
    return null;
  })();

  return locationPromise;
}

interface AmapRegeoResponse {
  regeocode: {
    formatted_address: string;
    addressComponent: {
      province: string;
      city: string | string[];
      district: string;
    };
  };
}

async function reverseGeocodeCity(location: { lng: number; lat: number }): Promise<string | null> {
  if (!AMAP_KEY) return null;
  try {
    const data = await amapFetch<AmapRegeoResponse>(
      `https://restapi.amap.com/v3/geocode/regeo?location=${location.lng},${location.lat}&extensions=base`
    );
    const city = data?.regeocode?.addressComponent?.city;
    if (city) {
      const cityStr = Array.isArray(city) ? city[0] : city;
      if (cityStr && typeof cityStr === 'string' && cityStr.length > 0) return cityStr;
    }
    const province = data?.regeocode?.addressComponent?.province;
    if (province && typeof province === 'string') return province;
  } catch {
    /* ignore */
  }
  return null;
}

export async function resolveUserCity(): Promise<string> {
  const manualCity = getManualCity();
  if (manualCity) {
    cachedUserCity = manualCity;
    return manualCity;
  }

  if (cachedUserCity) return cachedUserCity;
  if (cityPromise) return cityPromise;

  cityPromise = (async () => {
    const location = await getUserLocation();
    if (location) {
      const regeoCity = await reverseGeocodeCity(location);
      if (regeoCity) {
        cachedUserCity = regeoCity;
        return regeoCity;
      }
    }

    if (!cachedUserCity && dataSource.hasAmap) {
      try {
        const data = await amapFetch<{ city: string | string[] }>(
          'https://restapi.amap.com/v3/ip?extensions=base'
        );
        if (data?.city) {
          const cityStr = Array.isArray(data.city) ? data.city[0] : data.city;
          if (cityStr) {
            cachedUserCity = cityStr;
            return cityStr;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (!cachedUserCity) {
      cachedUserCity = '北京';
    }
    return cachedUserCity;
  })();

  return cityPromise;
}

interface AmapAroundResponse {
  pois: (AmapPoiItem & { distance: string })[];
}

function parseLocation(loc: string): { lng: number; lat: number } | null {
  const [lng, lat] = loc.split(',').map(Number);
  if (isNaN(lng) || isNaN(lat)) {
    return null;
  }
  return { lng, lat };
}

function formatLocation(loc: { lng: number; lat: number }): string {
  return `${loc.lng.toFixed(6)},${loc.lat.toFixed(6)}`;
}

function mapPoiItem(poi: AmapPoiItem): POIResult | null {
  const location = parseLocation(poi.location);
  if (!location) return null;

  let rating = '0';
  let cost = '0';
  let openTime: string | undefined;
  if (poi.biz_ext && poi.biz_ext.length > 0) {
    const ext = poi.biz_ext[0];
    rating = typeof ext.rating === 'string' && ext.rating ? ext.rating : '0';
    cost = typeof ext.cost === 'string' && ext.cost ? ext.cost : '0';
    openTime = typeof ext.opentime2 === 'string' && ext.opentime2 ? ext.opentime2 : undefined;
  }

  return {
    id: poi.id,
    name: poi.name,
    address: poi.address,
    phone: poi.tel || '暂无',
    rating,
    cost,
    location,
    type: poi.type,
    distance: poi.distance || '0',
    poiId: poi.id,
    photos: (poi.photos?.map((p) => p.url).filter(Boolean) as string[]) || [],
    businessArea: poi.business_area || undefined,
    openTime,
  };
}

export async function searchNearbyPOI(
  keywords: string,
  location: { lng: number; lat: number },
  radius: number = DEFAULT_SEARCH_RADIUS,
  types?: string
): Promise<POIResult[]> {
  const cacheKey = `nearby_${keywords}_${location.lng}_${location.lat}_${radius}_${types}`;
  const cached = poiCache.get(cacheKey) as POIResult[] | undefined;
  if (cached) {
    return cached;
  }

  const typeParam = types ? `&types=${types}` : '';
  const data = await amapFetch<AmapAroundResponse>(
    `https://restapi.amap.com/v3/place/around?keywords=${encodeURIComponent(keywords)}&location=${formatLocation(location)}&radius=${radius}${typeParam}&extensions=all&sortrule=distance`
  );

  if (!data?.pois) return emptyPoiResults();

  const results = data.pois
    .slice(0, MAX_POI_RESULTS)
    .map(mapPoiItem)
    .filter((item): item is POIResult => item !== null);

  poiCache.set(cacheKey, results, POI_CACHE_TTL_MS);
  return results;
}

export async function searchPOI(
  keywords: string,
  city: string,
  types?: string
): Promise<POIResult[]> {
  if (!keywords || !keywords.trim()) return [];
  const cacheKey = `text_${keywords}_${city}_${types}`;
  const cached = poiCache.get(cacheKey) as POIResult[] | undefined;
  if (cached) {
    return cached;
  }

  const typeParam = types ? `&types=${types}` : '';
  const data = await amapFetch<AmapPoiResponse>(
    `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&citylimit=true${typeParam}&extensions=all`
  );

  if (!data?.pois) return emptyPoiResults();

  const results = data.pois
    .slice(0, MAX_POI_RESULTS)
    .map(mapPoiItem)
    .filter((item): item is POIResult => item !== null);

  poiCache.set(cacheKey, results, POI_CACHE_TTL_MS);
  return results;
}

export async function searchSmartNearby(
  keywords: string,
  city: string,
  radius: number = 5000,
  types?: string
): Promise<POIResult[]> {
  if (!dataSource.hasAmap) {
    return [];
  }

  // 防止空参数导致 INVALID_PARAMS
  if (!keywords || !keywords.trim()) {
    return [];
  }

  const cacheKey = `smart_${keywords}_${city}_${radius}_${types}`;
  const cached = poiCache.get(cacheKey) as POIResult[] | undefined;
  if (cached) {
    return cached;
  }

  const [location, resolvedUserCity] = await Promise.all([
    getUserLocation(),
    resolveUserCity().catch(() => ''),
  ]);

  let results: POIResult[] = [];

  const shouldPreferCitySearch = !!city && (!location || !isSameCityName(city, resolvedUserCity));

  if (shouldPreferCitySearch) {
    results = await searchPOI(keywords, city, types);
  }

  if (results.length === 0 && location) {
    const nearbyResults = await searchNearbyPOI(keywords, location, radius, types);
    // 过滤掉不属于目标城市的 POI
    if (city && nearbyResults.length > 0) {
      results = nearbyResults.filter((poi) => {
        const addr = (poi.address || '').toLowerCase();
        const cityName = city.toLowerCase();
        return addr.includes(cityName) || !poi.address; // 无地址的保留
      });
    } else {
      results = nearbyResults;
    }
  }

  if (results.length === 0 && city) {
    results = await searchPOI(keywords, city, types);
  }

  poiCache.set(cacheKey, results, POI_CACHE_TTL_MS);
  return results;
}

export interface InputTip {
  id: string;
  name: string;
  district: string;
  adcode: string;
  address: string;
}

interface AmapInputTipsResponse {
  tips: Array<{
    id: string;
    name: string;
    district: string;
    adcode: string;
    address: string;
  }>;
}

export async function searchInputTips(keywords: string, city?: string): Promise<InputTip[]> {
  if (!AMAP_KEY || !keywords.trim()) return [];

  const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
  const data = await amapFetch<AmapInputTipsResponse>(
    `https://restapi.amap.com/v3/assistant/inputtips?keywords=${encodeURIComponent(keywords)}${cityParam}`
  );

  if (!data?.tips) return [];

  return data.tips.slice(0, MAX_INPUT_TIPS).map((tip) => ({
    id: tip.id,
    name: tip.name,
    district: tip.district,
    adcode: tip.adcode,
    address: tip.address,
  }));
}

export interface POIDetail {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: string;
  cost: string;
  type: string;
  location: { lng: number; lat: number };
  openTime?: string;
  photos?: Array<{ url: string }>;
  description?: string;
  distance?: string;
}

interface AmapDetailPoiItem {
  id: string;
  name: string;
  address: string;
  tel: string;
  biz_ext?: { rating?: string; cost?: string; opentime2?: string };
  type: string;
  location: string;
  photos?: Array<{ title?: string | string[]; url?: string; photo?: string }>;
  big_photos?: Array<{ title?: string | string[]; url?: string; photo?: string }>;
  description?: string;
}

interface AmapDetailResponse {
  pois?: AmapDetailPoiItem[];
  poiinfo?: AmapDetailPoiItem;
}

export async function fetchPOIDetail(poiId: string): Promise<POIDetail | null> {
  const data = await amapFetch<AmapDetailResponse>(
    `https://restapi.amap.com/v3/place/detail?id=${poiId}`
  );

  const poi = data?.pois?.[0] || data?.poiinfo;
  if (!poi) return null;

  const location = parseLocation(poi.location);
  if (!location) return null;

  const rawPhotos = poi.photos || [];
  const rawBigPhotos = poi.big_photos || [];
  const allRawPhotos = [...rawBigPhotos, ...rawPhotos];
  const mappedPhotos = allRawPhotos
    .map((p) => ({ url: p.url || (typeof p.photo === 'string' ? p.photo : '') || '' }))
    .filter((p) => p.url.startsWith('http'));

  return {
    id: poi.id,
    name: poi.name,
    address: poi.address,
    phone: poi.tel || '暂无',
    rating: poi.biz_ext?.rating || '0',
    cost: poi.biz_ext?.cost || '0',
    type: poi.type,
    location,
    openTime: poi.biz_ext?.opentime2,
    photos: mappedPhotos.length > 0 ? mappedPhotos : undefined,
    description: poi.description,
  };
}

export async function geocodeAddress(
  address: string,
  city?: string
): Promise<{ lng: number; lat: number } | null> {
  const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
  const data = await amapFetch<{ geocodes: Array<{ location: string }> }>(
    `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}${cityParam}`
  );

  if (!data?.geocodes?.[0]?.location) return null;

  return parseLocation(data.geocodes[0].location);
}

interface AmapWalkingResponse {
  route: {
    origin: string;
    destination: string;
    paths: Array<{
      distance: string;
      duration: string;
      steps: Array<{ instruction: string; road: string; polyline?: string }>;
    }>;
  };
}

interface AmapTransitResponse {
  route: {
    origin: string;
    destination: string;
    transits: Array<{
      distance: string;
      duration: string;
      segments: Array<{
        bus?: {
          buslines?: Array<{
            name: string;
            type?: string;
            polyline?: string;
            departure_stop?: { name?: string };
            arrival_stop?: { name?: string };
            via_num?: string;
          }>;
        };
        railway?: {
          name?: string;
          departure_stop?: { name?: string };
          arrival_stop?: { name?: string };
        };
        taxi?: { distance?: string; duration?: string; cost?: string };
        walking?: { distance: string; polyline?: string };
      }>;
    }>;
  };
}

interface AmapDrivingResponse {
  route: {
    origin: string;
    destination: string;
    paths: Array<{
      distance: string;
      duration: string;
      steps: Array<{ instruction: string; road: string; polyline?: string }>;
    }>;
  };
}

interface AmapBicycleResponse {
  data: {
    paths?: Array<{
      distance: string;
      duration: string;
      polyline?: string;
      steps?: Array<{
        instruction?: string;
      }>;
    }>;
    routes?: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        instruction: string;
      }>;
      polyline?: string;
    }>;
  };
}

export async function planWalkingRoute(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number }
): Promise<(RouteResult & { polyline?: string }) | null> {
  const data = await amapFetch<AmapWalkingResponse>(
    `https://restapi.amap.com/v3/direction/walking?origin=${formatLocation(from)}&destination=${formatLocation(to)}`
  );

  if (!data?.route?.paths?.[0]) return null;
  const path = data.route.paths[0];
  const polyline = path.steps.map((s) => s.polyline || '').join(';');
  return {
    distance: parseInt(path.distance) || 0,
    duration: Math.round((parseInt(path.duration) || 0) / 60),
    mode: 'walking',
    steps: path.steps.map((s) => `${s.instruction}${s.road ? ` (${s.road})` : ''}`).filter(Boolean),
    polyline: polyline || undefined,
  };
}

export async function planTransitRoute(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  city: string
): Promise<(RouteResult & { polyline?: string }) | null> {
  const data = await amapFetch<AmapTransitResponse>(
    `https://restapi.amap.com/v3/direction/transit/integrated?origin=${formatLocation(from)}&destination=${formatLocation(to)}&city=${encodeURIComponent(city)}`
  );

  if (!data?.route?.transits?.[0]) return null;
  const transit = data.route.transits[0];
  const transitDetails = transit.segments
    .flatMap(
      (segment) =>
        segment.bus?.buslines
          ?.map((line) => {
            const lineName = (line.name || '').replace(/\(.*?\)/g, '').trim();
            if (!lineName) return null;
            return {
              lineName,
              lineType: line.type?.includes('地铁') || lineName.includes('地铁') ? '地铁' : '公交',
              stationCount: Math.max((parseInt(line.via_num || '0', 10) || 0) + 1, 1),
              startStation: line.departure_stop?.name || '上车站',
              endStation: line.arrival_stop?.name || '下车站',
            };
          })
          .filter(Boolean) || []
    )
    .filter((detail): detail is NonNullable<typeof detail> => detail !== null);
  const busLines = transitDetails.map((detail) => detail.lineName);
  const polyline = transit.segments
    .flatMap((segment) => [
      segment.walking?.polyline || '',
      ...(segment.bus?.buslines?.map((line) => line.polyline || '') || []),
    ])
    .filter(Boolean)
    .join(';');

  return {
    distance: parseInt(transit.distance) || 0,
    duration: Math.round((parseInt(transit.duration) || 0) / 60),
    mode: 'transit',
    steps: busLines.length > 0 ? [`乘坐 ${busLines.join(' → ')}`] : ['步行前往'],
    polyline: polyline || undefined,
    transfers: Math.max(busLines.length - 1, 0),
    walkingDistance: transit.segments.reduce(
      (sum, segment) => sum + (parseInt(segment.walking?.distance || '0', 10) || 0),
      0
    ),
    transitDetails: transitDetails.length > 0 ? transitDetails : undefined,
  };
}

export async function planDrivingRoute(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number }
): Promise<(RouteResult & { polyline?: string }) | null> {
  const data = await amapFetch<AmapDrivingResponse>(
    `https://restapi.amap.com/v3/direction/driving?origin=${formatLocation(from)}&destination=${formatLocation(to)}`
  );

  if (!data?.route?.paths?.[0]) return null;
  const path = data.route.paths[0];
  const polyline = path.steps.map((s) => s.polyline || '').join(';');
  return {
    distance: parseInt(path.distance) || 0,
    duration: Math.round((parseInt(path.duration) || 0) / 60),
    mode: 'driving',
    steps: path.steps
      .slice(0, MAX_DRIVING_STEPS)
      .map((s) => s.instruction)
      .filter(Boolean),
    polyline: polyline || undefined,
  };
}

export async function planBicycleRoute(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number }
): Promise<(RouteResult & { polyline?: string }) | null> {
  const data = await amapFetch<AmapBicycleResponse>(
    `https://restapi.amap.com/v4/direction/bicycling?origin=${formatLocation(from)}&destination=${formatLocation(to)}`
  );

  const path = data?.data?.paths?.[0];
  if (path) {
    return {
      distance: parseInt(path.distance, 10) || 0,
      duration: Math.round((parseInt(path.duration, 10) || 0) / 60),
      mode: 'cycling',
      steps: (path.steps || [])
        .slice(0, MAX_BICYCLE_STEPS)
        .map((s) => s.instruction || '')
        .filter(Boolean),
      polyline: path.polyline,
    };
  }

  const legacyRoute = data?.data?.routes?.[0];
  if (!legacyRoute) return null;
  return {
    distance: legacyRoute.distance,
    duration: Math.round(legacyRoute.duration / 60),
    mode: 'cycling',
    steps: legacyRoute.steps
      .slice(0, MAX_BICYCLE_STEPS)
      .map((s) => s.instruction)
      .filter(Boolean),
    polyline: legacyRoute.polyline,
  };
}

export async function planMultiPointRoute(
  points: Array<{ lng: number; lat: number }>,
  mode: TravelMode = 'walking',
  city: string = '北京'
): Promise<{ totalDistance: number; totalDuration: number; segments: RouteResult[] }> {
  if (points.length < 2) {
    return { totalDistance: 0, totalDuration: 0, segments: [] };
  }

  const routePromises = points.slice(0, -1).map((_, i) => {
    const from = points[i];
    const to = points[i + 1];

    switch (mode) {
      case 'driving':
        return planDrivingRoute(from, to);
      case 'taxi':
        return planDrivingRoute(from, to);
      case 'cycling':
        return planBicycleRoute(from, to);
      case 'transit':
        return planTransitRoute(from, to, city);
      default:
        return planWalkingRoute(from, to);
    }
  });

  const results = await Promise.all(routePromises);
  const segments = results.filter((r): r is RouteResult => r !== null);

  const totalDistance = segments.reduce((sum, r) => sum + r.distance, 0);
  const totalDuration = segments.reduce((sum, r) => sum + r.duration, 0);

  return { totalDistance, totalDuration, segments };
}

interface AmapWeatherResponse {
  lives: Array<{
    city: string;
    adcode: string;
    weather: string;
    temperature: string;
    winddirection: string;
    windpower: string;
    humidity: string;
    reporttime: string;
  }>;
  forecasts: Array<{
    city: string;
    adcode: string;
    date: string;
    week: string;
    dayweather: string;
    nightweather: string;
    daytemp: string;
    nighttemp: string;
    daywind: string;
    nightwind: string;
    daypower: string;
    nightpower: string;
  }>;
}

export interface WeatherResponse {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  windDirection: string;
  windPower: string;
  forecast: Array<{
    date: string;
    dayCondition: string;
    nightCondition: string;
    high: number;
    low: number;
  }>;
}

const WEATHER_EN_TO_CN: Record<string, string> = {
  Clear: '晴',
  Cloudy: '多云',
  Overcast: '阴',
  Rain: '雨',
  Drizzle: '小雨',
  Showers: '阵雨',
  Thunderstorm: '雷阵雨',
  Snow: '雪',
  Sleet: '雨夹雪',
  Hail: '冰雹',
  Fog: '雾',
  Haze: '霾',
  Dust: '浮尘',
  Sand: '扬沙',
  Wind: '大风',
  Tornado: '龙卷风',
  Hurricane: '飓风',
  Typhoon: '台风',
  Sunny: '晴',
  PartlyCloudy: '多云',
  MostlyCloudy: '多云',
  LightRain: '小雨',
  ModerateRain: '中雨',
  HeavyRain: '大雨',
  Storm: '暴雨',
  HeavyStorm: '大暴雨',
  SevereStorm: '特大暴雨',
  LightSnow: '小雪',
  ModerateSnow: '中雪',
  HeavySnow: '大雪',
  Blizzard: '暴雪',
  FreezingRain: '冻雨',
  Mist: '轻雾',
  Smog: '雾霾',
  Unknown: '未知',
};

export function translateWeather(en: string): string {
  if (!en) return '未知';
  const key = en.replace(/\s+/g, '');
  return WEATHER_EN_TO_CN[key] || WEATHER_EN_TO_CN[en] || en;
}

export async function fetchWeatherFromAmap(city: string): Promise<WeatherResponse | null> {
  if (!AMAP_KEY) return null;
  try {
    // 先获取实时天气（extensions=base 返回 lives）
    const res = await fetch(
      `https://restapi.amap.com/v3/weather/weatherInfo?city=${encodeURIComponent(city)}&extensions=base&key=${AMAP_KEY}`,
      { signal: AbortSignal.timeout(AMAP_API_TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.lives?.[0]) return null;

    const live = data.lives[0];

    // 再获取预报（extensions=all 返回 forecasts）
    let forecasts: WeatherResponse['forecast'] = [];
    try {
      const forecastRes = await fetch(
        `https://restapi.amap.com/v3/weather/weatherInfo?city=${encodeURIComponent(city)}&extensions=all&key=${AMAP_KEY}`,
        { signal: AbortSignal.timeout(AMAP_API_TIMEOUT_MS) }
      );
      if (forecastRes.ok) {
        const forecastData = await forecastRes.json();
        forecasts = (forecastData.forecasts?.[0]?.casts || [])
          .slice(0, 4)
          .map((f: Record<string, string>) => ({
            date: f.date,
            dayCondition: translateWeather(f.dayweather),
            nightCondition: translateWeather(f.nightweather),
            high: parseInt(f.daytemp) || 25,
            low: parseInt(f.nighttemp) || 18,
          }));
      }
    } catch {
      /* ignore forecast errors */
    }

    return {
      city: live.city,
      temp: parseInt(live.temperature) || 24,
      condition: translateWeather(live.weather),
      humidity: parseInt(live.humidity) || 60,
      windDirection: live.winddirection,
      windPower: live.windpower,
      forecast: forecasts,
    };
  } catch {
    return null;
  }
}

export function getMockPOI(keywords: string, city: string): POIResult[] {
  const seededFloat = (seed: string, min: number, max: number): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const normalized = Math.abs(hash) / 0x7fffffff;
    return min + normalized * (max - min);
  };

  const seededInt = (seed: string, min: number, max: number): number => {
    return Math.floor(seededFloat(seed, min, max + 1));
  };

  const seededPhone = (seed: string, prefix: string): string => {
    const num = seededInt(seed, 10000000, 99999999);
    return `${prefix}${num}`;
  };

  const restaurants = [
    {
      name: `${city}${keywords}`,
      address: `${city}市中心商业区`,
      phone: seededPhone(`${city}${keywords}a`, '010-8888'),
      rating: String(seededFloat(`${city}${keywords}ratingA`, 4.2, 4.8)),
      cost: String(seededInt(`${city}${keywords}costA`, 80, 220)),
      location: {
        lng: 116.397 + seededInt(`${city}${keywords}lngA`, 1, 20) / 1000,
        lat: 39.908 + seededInt(`${city}${keywords}latA`, 1, 20) / 1000,
      },
      type: '餐饮',
      distance: String(seededInt(`${city}${keywords}distA`, 500, 2600)),
    },
    {
      name: `${keywords}·${city}店`,
      address: `${city}繁华地段`,
      phone: seededPhone(`${city}${keywords}b`, '010-7777'),
      rating: String(seededFloat(`${city}${keywords}ratingB`, 4.3, 4.9)),
      cost: String(seededInt(`${city}${keywords}costB`, 60, 180)),
      location: {
        lng: 116.397 + seededInt(`${city}${keywords}lngB`, 6, 28) / 1000,
        lat: 39.908 + seededInt(`${city}${keywords}latB`, 6, 28) / 1000,
      },
      type: '餐饮',
      distance: String(seededInt(`${city}${keywords}distB`, 300, 2000)),
    },
  ];
  return restaurants;
}

export function getMockMeituanShop(name: string, city: string): MeituanShopResult {
  const seededFloat = (seed: string, min: number, max: number): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const normalized = Math.abs(hash) / 0x7fffffff;
    return min + normalized * (max - min);
  };

  const seededInt = (seed: string, min: number, max: number): number => {
    return Math.floor(seededFloat(seed, min, max + 1));
  };

  return {
    name,
    avgPrice: seededInt(`${name}${city}avg`, 80, 220),
    rating: seededFloat(`${name}${city}rating`, 4.2, 4.8),
    address: `${city}市中心商业街${seededInt(`${name}${city}street`, 18, 168)}号`,
    phone: `010-${seededInt(`${name}${city}phoneA`, 1000, 9999)}-${seededInt(`${name}${city}phoneB`, 1000, 9999)}`,
    openTime: '10:00-22:00',
    hasQueue: seededInt(`${name}${city}queue`, 0, 10) > 3,
    estimatedWait: seededInt(`${name}${city}wait`, 6, 28),
  };
}

export function getDataSourceLabel(): { label: string; color: string; bgColor: string } {
  if (dataSource.hasAmap) {
    return { label: '高德地图 · 实时数据', color: 'text-emerald-700', bgColor: 'bg-emerald-50' };
  }
  return { label: '本地推荐整理', color: 'text-amber-700', bgColor: 'bg-amber-50' };
}

export interface DirectionResult {
  distance: number;
  duration: number;
  polyline?: string;
}

export async function planCyclingRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<DirectionResult> {
  const data = await amapFetch<{
    data?: { paths?: Array<{ distance: string; duration: string; polyline: string }> };
    info?: string;
  }>(
    `https://restapi.amap.com/v4/direction/bicycling?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`
  );

  if (!data?.data?.paths?.[0]) {
    throw new Error('NO_CYCLING_FOUND');
  }

  const path = data.data.paths[0];
  return {
    distance: parseInt(path.distance, 10) || 0,
    duration: parseInt(path.duration, 10) || 0,
    polyline: path.polyline,
  };
}

export async function planRoute(
  origin: { lat: number; lng: number; name?: string },
  destination: { lat: number; lng: number; name?: string },
  mode: TravelMode,
  city?: string
): Promise<DirectionResult | null> {
  const from = { lng: origin.lng, lat: origin.lat };
  const to = { lng: destination.lng, lat: destination.lat };
  switch (mode) {
    case 'driving':
      return planDrivingRoute(from, to);
    case 'taxi':
      return planDrivingRoute(from, to);
    case 'transit':
      return planTransitRoute(from, to, city || 'beijing');
    case 'walking':
      return planWalkingRoute(from, to);
    case 'cycling':
      return planCyclingRoute(origin, destination);
    default:
      return planWalkingRoute(from, to);
  }
}

export function estimateTaxiDispatch(params: {
  peopleCount: number;
  hasChild: boolean;
  hasElder: boolean;
  comfortPreferred: boolean;
  budgetSensitive: boolean;
  distanceMeters: number;
  durationMinutes: number;
}): TaxiDispatchRecommendation {
  const {
    peopleCount,
    hasChild,
    hasElder,
    comfortPreferred,
    budgetSensitive,
    distanceMeters,
    durationMinutes,
  } = params;

  let tier: TaxiDispatchRecommendation['tier'] = 'economy';
  let tierLabel = '快车';
  let reason = '适合当前人数，叫车会更快';
  let carCount = 1;
  const comfortTags: string[] = [];

  if (peopleCount >= 5) {
    tier = 'six_seat';
    tierLabel = '六座商务';
    reason = '多人同行，一车直达更稳妥';
    comfortTags.push('大空间');
  } else if (hasChild || hasElder || comfortPreferred) {
    tier = 'comfort';
    tierLabel = '舒适型';
    reason = hasChild || hasElder ? '有老人或儿童，优先减少步行和换乘' : '更适合舒适出行';
    comfortTags.push(hasChild || hasElder ? '上下车更稳' : '乘坐舒适');
  } else if (peopleCount === 4 && budgetSensitive) {
    tier = 'economy';
    tierLabel = '两辆快车';
    reason = '4人同行但更看重预算，拆两辆更灵活';
    carCount = 2;
    comfortTags.push('预算更稳');
  } else if (peopleCount === 4) {
    tier = 'business';
    tierLabel = '优享/商务';
    reason = '4人同行更适合宽敞一些的车型';
    comfortTags.push('乘坐宽敞');
  }

  const baseFare = 14 + (distanceMeters / 1000) * 2.6 + durationMinutes * 0.7;
  const tierMultiplier =
    tier === 'economy' ? 1 : tier === 'comfort' ? 1.22 : tier === 'business' ? 1.5 : 1.82;
  const estimatedFare = Math.round(baseFare * tierMultiplier * carCount);
  const estimatedWaitMinutes = Math.max(
    2,
    Math.min(12, Math.round(3 + distanceMeters / 4000 + (tier === 'six_seat' ? 3 : 0)))
  );

  return {
    tier,
    tierLabel,
    reason,
    estimatedFare,
    estimatedWaitMinutes,
    carCount,
    passengerSummary: `${peopleCount} 人同行${hasChild ? ' · 含儿童' : ''}${hasElder ? ' · 含长辈' : ''}`,
    comfortTags,
  };
}
