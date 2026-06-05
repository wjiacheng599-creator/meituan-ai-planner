import type { TaskSession } from '../types';

function sessionRichness(session: TaskSession): number {
  return (
    (session.messages?.length || 0) * 1000 +
    (session.planId ? 100 : 0) +
    (session.queryDraft?.trim() ? 10 : 0) +
    (session.planTitle?.trim() ? 5 : 0)
  );
}

function preferRicherSession(first: TaskSession, second: TaskSession): TaskSession {
  const firstScore = sessionRichness(first);
  const secondScore = sessionRichness(second);
  if (firstScore !== secondScore) return secondScore > firstScore ? second : first;
  return second.updatedAt > first.updatedAt ? second : first;
}

export function mergeTaskSessions(...groups: TaskSession[][]): TaskSession[] {
  const byId = new Map<string, TaskSession>();

  groups.flat().forEach((session) => {
    const existing = byId.get(session.id);
    byId.set(session.id, existing ? preferRicherSession(existing, session) : session);
  });

  const byPlanId = new Map<string, TaskSession>();
  const sessionsWithoutPlan: TaskSession[] = [];

  byId.forEach((session) => {
    if (!session.planId) {
      sessionsWithoutPlan.push(session);
      return;
    }
    const existing = byPlanId.get(session.planId);
    byPlanId.set(session.planId, existing ? preferRicherSession(existing, session) : session);
  });

  return [...byPlanId.values(), ...sessionsWithoutPlan].sort((a, b) => b.updatedAt - a.updatedAt);
}
