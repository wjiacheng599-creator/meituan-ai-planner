/**
 * PlanController
 *
 * HTTP layer for plan CRUD endpoints.
 * AI generation (generatePlan, streaming) is handled inline in server/index.ts.
 */
import type { Request, Response } from 'express';
import { PlanService } from '../services/planService';

function safeErrorMessage(error: unknown, fallback: string): string {
  if (process.env.NODE_ENV === 'production') return fallback;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function createPlanController(planService: PlanService) {
  async function getPlans(req: Request, res: Response) {
    try {
      const plans = await planService.getUserPlans('');
      res.json({ plans });
    } catch (error) {
      console.error('[plan] list failed:', error);
      res.status(500).json({ error: safeErrorMessage(error, 'PLAN_LIST_FAILED') });
    }
  }

  async function getPlanById(req: Request, res: Response) {
    try {
      const plan = await planService.getPlanById(req.params.id);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }
      res.json({ plan });
    } catch (error) {
      console.error('[plan] get failed:', error);
      res.status(500).json({ error: safeErrorMessage(error, 'PLAN_GET_FAILED') });
    }
  }

  async function deletePlan(req: Request, res: Response) {
    try {
      await planService.deletePlan(req.params.id, '');
      res.json({ success: true });
    } catch (error) {
      const msg = safeErrorMessage(error, 'PLAN_DELETE_FAILED');
      if (msg === 'PLAN_NOT_FOUND') {
        res.status(404).json({ error: msg });
        return;
      }
      console.error('[plan] delete failed:', error);
      res.status(500).json({ error: msg });
    }
  }

  async function sharePlan(req: Request, res: Response) {
    try {
      const share = await planService.sharePlan(req.params.id);
      res.json(share);
    } catch (error) {
      console.error('[plan] share failed:', error);
      res.status(500).json({ error: safeErrorMessage(error, 'SHARE_FETCH_FAILED') });
    }
  }

  return { getPlans, getPlanById, deletePlan, sharePlan };
}
