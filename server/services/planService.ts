/**
 * PlanService
 *
 * Business logic for plan management.
 * Uses ServerRepository interface (extracted from server/index.ts — plan endpoints)
 */
import type { ServerRepository, PersistedPlanRecord } from '../repository/types';
import type { Plan } from '../../src/services/ai';
import type { PlannerTaskState } from '../../src/types';

export class PlanService {
  constructor(private repository: ServerRepository) {}

  async saveGeneratedPlan(params: {
    userId: string;
    query: string;
    plan: Plan;
    sessionId?: string;
  }) {
    return this.repository.saveGeneratedPlan(params);
  }

  async getPlanById(planId: string) {
    const record = await this.repository.getPlanById(planId);
    return record?.plan ?? null;
  }

  async getUserPlans(userId: string) {
    const payload = await this.repository.getBootstrapPayload(userId, { page: 1, limit: 100 });
    return payload.plannerTaskStates.map(state => ({
      taskState: state,
      plan: (state as unknown as { plan?: Plan }).plan ?? null,
    }));
  }

  async deletePlan(planId: string, userId: string) {
    // Check ownership via PersistedPlanRecord (which has userId)
    const planRecord = await this.repository.getPlanById(planId);
    if (!planRecord || planRecord.userId !== userId) {
      throw new Error('PLAN_NOT_FOUND');
    }
    // Soft delete: mark task state as deleted
    const state = await this.repository.getTaskStateByPlanId(planId);
    if (state) {
      const deletedState: PlannerTaskState = { ...state, status: 'archived' };
      await this.repository.replacePlannerTaskStates({ taskStates: [deletedState] });
    }
  }

  async sharePlan(planId: string) {
    const planRecord = await this.repository.getPlanById(planId);
    if (!planRecord || !planRecord.plan) {
      throw new Error('PLAN_NOT_FOUND');
    }
    const state = await this.repository.getTaskStateByPlanId(planId);
    const record = await this.repository.createShareRecord({
      userId: planRecord.userId,
      plan: planRecord.plan,
      profiles: [],
      taskState: state ?? undefined,
    });
    return record;
  }
}
