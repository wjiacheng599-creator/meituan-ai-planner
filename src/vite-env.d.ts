/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: string;
  readonly VITE_DASHSCOPE_API_KEY?: string;
  readonly VITE_LONGCAT_API_KEY?: string;
  readonly VITE_USE_REAL_AGENT?: string;
  readonly VITE_DEMO_MODE_FAST?: string;
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_JS_KEY?: string;
  readonly VITE_AMAP_SECURITY_CODE?: string;
  readonly VITE_AMAP_SERVICE_HOST?: string;
  readonly VITE_AMAP_USE_PROXY?: string;
  readonly VITE_AMAP_PROXY_HOST?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
