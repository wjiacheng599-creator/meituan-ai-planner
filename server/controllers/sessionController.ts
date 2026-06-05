/**
 * SessionController
 *
 * HTTP layer for session endpoints.
 */
import type { Request, Response } from 'express';
import { SessionService } from '../services/sessionService';
import { resolveUser } from '../middleware/auth';

function safeErrorMessage(error: unknown, fallback: string): string {
  if (process.env.NODE_ENV === 'production') return fallback;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function createSessionController(sessionService: SessionService) {
  async function getSessions(req: Request, res: Response) {
    try {
      const user = await resolveUser(req, res);
      if (!user) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
      const sessions = await sessionService.getSessionsByUser(user.id);
      res.json({ sessions });
    } catch (error) {
      console.error('[session] list failed:', error);
      res.status(500).json({ error: safeErrorMessage(error, 'SESSION_LIST_FAILED') });
    }
  }

  async function createSession(req: Request, res: Response) {
    try {
      const user = await resolveUser(req, res);
      if (!user) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
      const { title, context } = req.body || {};
      const session = await sessionService.createSession({ userId: user.id, title, context });
      res.json({ session });
    } catch (error) {
      console.error('[session] create failed:', error);
      res.status(500).json({ error: safeErrorMessage(error, 'SESSION_CREATE_FAILED') });
    }
  }

  async function deleteSession(req: Request, res: Response) {
    try {
      const user = await resolveUser(req, res);
      if (!user) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
      await sessionService.deleteSession(req.params.id, user.id);
      res.json({ success: true });
    } catch (error) {
      const msg = safeErrorMessage(error, 'SESSION_DELETE_FAILED');
      if (msg === 'SESSION_NOT_FOUND') {
        res.status(404).json({ error: msg });
        return;
      }
      console.error('[session] delete failed:', error);
      res.status(500).json({ error: msg });
    }
  }

  return { getSessions, createSession, deleteSession };
}
