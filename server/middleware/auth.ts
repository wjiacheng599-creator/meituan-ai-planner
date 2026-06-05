/**
 * Authentication Middleware
 *
 * Resolves user identity from signed cookies.
 * Uses cookie.ts utilities (HMAC-SHA256 signature verification).
 */
import type { Request, Response, NextFunction } from 'express';
import { verifySignedUserId, parseCookie } from './cookie';

export interface AuthenticatedUser {
  id: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export async function resolveUser(req: Request, res: Response): Promise<AuthenticatedUser | null> {
  const cookies = parseCookie(req.headers.cookie);
  const signed = cookies['mt_planner_uid'];
  if (!signed) return null;

  const userId = verifySignedUserId(signed);
  if (!userId) return null;

  req.user = { id: userId };
  return req.user;
}

export function requireAuth(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await resolveUser(req, res);
    if (!user) {
      res.status(401).json({ message: 'UNAUTHORIZED' });
      return;
    }
    req.user = user;
    await handler(req, res);
  };
}
