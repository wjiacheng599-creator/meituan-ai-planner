import { describe, expect, it } from 'vitest';
import type { TaskSession } from '../types';
import { mergeTaskSessions } from './taskSessions';

function makeSession(
  id: string,
  options: Partial<Pick<TaskSession, 'planId' | 'messages' | 'updatedAt'>> = {}
): TaskSession {
  return {
    id,
    title: id,
    summary: id,
    queryDraft: '',
    updatedAt: options.updatedAt || 1,
    status: 'draft',
    selectedProfileIds: [],
    messages: options.messages || [],
    planId: options.planId,
  };
}

describe('mergeTaskSessions', () => {
  it('keeps the richer session when historical records share a plan', () => {
    const emptyServerSession = makeSession('server_session', {
      planId: 'plan_1',
      updatedAt: 20,
    });
    const localConversation = makeSession('local_session', {
      planId: 'plan_1',
      messages: [{ id: 'message_1', type: 'user', content: '保留这条消息' }],
      updatedAt: 10,
    });

    expect(mergeTaskSessions([emptyServerSession], [localConversation])).toEqual([
      localConversation,
    ]);
  });
});
