import { isBrowserRuntime } from '../services/runtimeEnv';

export async function withServerFallback<T>(
  serverFn: () => Promise<T>,
  localFn: () => Promise<T>,
  label: string
): Promise<T> {
  if (isBrowserRuntime()) {
    try {
      return await serverFn();
    } catch (error) {
      console.warn(`[serverFallback] ${label} failed, fallback to local`, error);
    }
  }
  return localFn();
}
