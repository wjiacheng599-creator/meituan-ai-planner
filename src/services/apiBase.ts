/**
 * Central API base URL utility.
 * In production (Vercel + Railway), this points to the Railway backend.
 * In local dev, it's empty (same origin).
 */
export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';

/**
 * Build a full API URL from a relative path.
 * Example: apiUrl('/api/auth/me') → 'https://backend.up.railway.app/api/auth/me'
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
