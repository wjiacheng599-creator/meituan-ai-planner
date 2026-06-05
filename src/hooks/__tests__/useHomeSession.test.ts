import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { TaskSession } from '../../types';
import { useHomeSession } from '../useHomeSession';

function makeSession(id: string, content: string): TaskSession {
  return {
    id,
    title: content,
    summary: content,
    queryDraft: content,
    updatedAt: 1,
    status: 'draft',
    selectedProfileIds: ['p1'],
    messages: [{ id: `${id}_message`, type: 'user', content }],
  };
}

function useSessionHarness(initialSessions: TaskSession[], initialActiveId: string | null) {
  const [taskSessions, setTaskSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialActiveId);
  const session = useHomeSession({
    taskSessions,
    activeSessionId,
    onTaskSessionsChange: setTaskSessions,
    onActiveSessionChange: setActiveSessionId,
    defaultBaseProfileId: 'p1',
  });

  return { taskSessions, activeSessionId, session };
}

describe('useHomeSession', () => {
  it('creates and activates an empty session while preserving the previous snapshot', () => {
    const previous = makeSession('session_a', '旧对话');
    const { result } = renderHook(() => useSessionHarness([previous], previous.id));

    result.current.session.setEditorStateRef.current = () => undefined;

    act(() => {
      result.current.session.startNewTaskSession();
    });

    expect(result.current.activeSessionId).not.toBe(previous.id);
    expect(result.current.taskSessions[0]).toMatchObject({
      id: result.current.activeSessionId,
      title: '新任务',
      queryDraft: '',
      messages: [],
    });
    expect(result.current.taskSessions.find((item) => item.id === previous.id)?.messages).toEqual(
      previous.messages
    );
  });

  it('persists a patch to the requested session instead of the active session', () => {
    const first = makeSession('session_a', '对话 A');
    const second = makeSession('session_b', '对话 B');
    const { result } = renderHook(() => useSessionHarness([first, second], second.id));

    act(() => {
      result.current.session.persistActiveSession({ summary: '只更新 A' }, first.id);
    });

    expect(result.current.taskSessions.find((item) => item.id === first.id)?.summary).toBe(
      '只更新 A'
    );
    expect(result.current.taskSessions.find((item) => item.id === second.id)?.summary).toBe(
      second.summary
    );
  });
});
