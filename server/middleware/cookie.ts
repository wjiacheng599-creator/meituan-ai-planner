/**
 * Cookie Authentication Middleware
 *
 * Provides HMAC-SHA256 signed user ID verification.
 * Extracted from server/index.ts (lines 86-101)
 */
import crypto from 'crypto';

function resolveCookieSecret(): string {
  const configured = process.env.COOKIE_SECRET;
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('COOKIE_SECRET must be configured in production');
  }

  console.warn('[cookie] COOKIE_SECRET not configured; using an ephemeral development secret');
  return crypto.randomBytes(32).toString('hex');
}

const COOKIE_SECRET = resolveCookieSecret();

export function signUserId(userId: string): string {
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(userId).digest('hex').slice(0, 16);
  return `${userId}.${hmac}`;
}

export function verifySignedUserId(signed: string): string | null {
  const dotIdx = signed.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const userId = signed.slice(0, dotIdx);
  const sig = signed.slice(dotIdx + 1);
  const expected = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(userId)
    .digest('hex')
    .slice(0, 16);
  return sig === expected ? userId : null;
}

export function parseCookie(header?: string): Record<string, string> {
  if (!header) return {};
  return header
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        acc[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
      }
      return acc;
    }, {});
}
