/**
 * SessionService
 *
 * Session management via ServerRepository.
 */
import type { ServerRepository, ServerSessionRecord } from '../repository/types';

export class SessionService {
  constructor(private repository: ServerRepository) {}

  async getSessionsByUser(userId: string) {
    const payload = await this.repository.getBootstrapPayload(userId, { page: 1, limit: 100 });
    return payload.sessions;
  }

  async createSession(params: { userId: string; title?: string; context?: string }) {
    const payload = await this.repository.getBootstrapPayload(params.userId, { page: 1, limit: 100 });
    const newSession: ServerSessionRecord = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: params.userId,
      title: params.title ?? 'New Session',
      summary: params.context ?? '',
      queryDraft: '',
      status: 'draft',
      updatedAt: Date.now(),
    };
    await this.repository.replaceSessions({
      userId: params.userId,
      sessions: [...payload.sessions, newSession],
    });
    return newSession;
  }

  async deleteSession(sessionId: string, userId: string) {
    const deleted = await this.repository.deleteSession(sessionId, userId);
    if (!deleted) {
      throw new Error('SESSION_NOT_FOUND');
    }
  }
}
