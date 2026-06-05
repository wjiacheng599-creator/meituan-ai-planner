const isBrowser = typeof window !== 'undefined';

const env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined) as
  | Record<string, string | undefined>
  | undefined;
const AMAP_JS_KEY = env?.VITE_AMAP_JS_KEY;
const AMAP_SECURITY_CODE = env?.VITE_AMAP_SECURITY_CODE;
const AMAP_SERVICE_HOST = env?.VITE_AMAP_SERVICE_HOST;
const API_BASE_URL = env?.VITE_API_BASE_URL || '';

export interface AMapScriptGlobal {
  plugin?: (plugins: string | string[], callback: () => void) => void;
  convertFrom?: (
    lnglat: [number, number] | Array<[number, number]>,
    type: string,
    callback: (status: string, result: { locations?: Array<unknown>; info?: string }) => void
  ) => void;
  getConfig?: () => { appname?: string };
  TileLayer?: {
    Traffic?: new (options?: Record<string, unknown>) => unknown;
  };
  Map?: new (container: HTMLElement, options?: Record<string, unknown>) => unknown;
  Scale?: new () => unknown;
  ToolBar?: new (options?: Record<string, unknown>) => unknown;
  ControlBar?: new (options?: Record<string, unknown>) => unknown;
  Marker?: new (options?: Record<string, unknown>) => unknown;
  Polyline?: new (options?: Record<string, unknown>) => unknown;
  Icon?: new (options?: Record<string, unknown>) => unknown;
  Size?: new (width: number, height: number) => unknown;
  Pixel?: new (x: number, y: number) => unknown;
  LngLat?: new (lng: number, lat: number) => unknown;
  Driving?: new (options?: Record<string, unknown>) => unknown;
  Transfer?: new (options?: Record<string, unknown>) => unknown;
  Walking?: new (options?: Record<string, unknown>) => unknown;
  Riding?: new (options?: Record<string, unknown>) => unknown;
  HawkEye?: new (options?: Record<string, unknown>) => unknown;
  MapType?: new (options?: Record<string, unknown>) => unknown;
  Buildings?: new (options?: Record<string, unknown>) => unknown;
}

declare global {
  interface Window {
    AMap?: AMapScriptGlobal;
    _AMapSecurityConfig?: { securityJsCode?: string; serviceHost?: string };
  }
}

let amapScriptPromise: Promise<AMapScriptGlobal | null> | null = null;

export function loadAmapScript(plugins?: string[]): Promise<AMapScriptGlobal | null> {
  if (!isBrowser) return Promise.resolve(null);
  if (!AMAP_JS_KEY) return Promise.resolve(null);
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapScriptPromise) return amapScriptPromise;

  const initSecurityConfig = async () => {
    if (AMAP_SERVICE_HOST) {
      window._AMapSecurityConfig = { serviceHost: AMAP_SERVICE_HOST };
    } else if (AMAP_SECURITY_CODE) {
      window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
    } else {
      try {
        const res = await fetch(`${API_BASE_URL}/api/amap-security-code`);
        if (res.ok) {
          const { code } = await res.json();
          if (code) window._AMapSecurityConfig = { securityJsCode: code };
        }
      } catch {
        // security code fetch failed, continue without it
      }
    }
  };

  amapScriptPromise = initSecurityConfig()
    .then(() => import('@amap/amap-jsapi-loader'))
    .then((mod) => {
      const AMapLoader = mod.default ?? mod;
      return AMapLoader.load({
        key: AMAP_JS_KEY,
        version: '2.0',
        plugins: plugins ?? [],
      });
    })
    .then((AMap: AMapScriptGlobal) => {
      const config = AMap.getConfig?.();
      if (config) {
        config.appname = 'amap-jsapi-skill';
      }
      window.AMap = AMap;
      return AMap;
    })
    .catch((e: unknown) => {
      console.error('[amapWeb] AMapLoader.load failed:', e);
      amapScriptPromise = null;
      return null;
    });

  return amapScriptPromise;
}

function normalizeConvertedLocation(location: unknown): { lng: number; lat: number } | null {
  if (!location || typeof location !== 'object') return null;
  const candidate = location as {
    lng?: number;
    lat?: number;
    getLng?: () => number;
    getLat?: () => number;
  };

  if (typeof candidate.lng === 'number' && typeof candidate.lat === 'number') {
    if (isNaN(candidate.lng) || isNaN(candidate.lat)) return null;
    return { lng: candidate.lng, lat: candidate.lat };
  }

  if (typeof candidate.getLng === 'function' && typeof candidate.getLat === 'function') {
    const lng = candidate.getLng();
    const lat = candidate.getLat();
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return null;
    return { lng, lat };
  }

  return null;
}

export async function convertGpsToAmap(location: {
  lng: number;
  lat: number;
}): Promise<{ lng: number; lat: number }> {
  const AMap = await loadAmapScript();
  if (!AMap?.convertFrom) return location;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(location), 5000);
    AMap.convertFrom?.([location.lng, location.lat], 'gps', (status, result) => {
      clearTimeout(timer);
      if (status !== 'complete') {
        resolve(location);
        return;
      }

      const converted = normalizeConvertedLocation(result.locations?.[0]);
      resolve(converted ?? location);
    });
  });
}

export function loadRoutePlugins(): Promise<void> {
  return loadAmapScript().then((AMap) => {
    if (!AMap) return;
    return new Promise<void>((resolve) => {
      AMap.plugin?.(['AMap.Driving', 'AMap.Transfer', 'AMap.Walking', 'AMap.Riding'], () => {
        resolve();
      });
    });
  });
}
