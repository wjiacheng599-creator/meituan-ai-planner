/**
 * availabilityController — 可用性预检控制器
 */

import type { Request, Response } from 'express';
import { checkAvailability, getAlternativesForType } from '../services/availabilityService';

export function createAvailabilityController() {
  return {
    /**
     * 预检活动可用性
     */
    checkAvailability(req: Request, res: Response) {
      try {
        const { activityTitle, activityType, timeLine, memberCount, price } = req.body;

        if (!activityTitle) {
          res.status(400).json({ error: 'MISSING_ACTIVITY_TITLE' });
          return;
        }

        const result = checkAvailability({
          activityId: req.body.activityId || '',
          activityTitle,
          activityType: activityType || 'activity',
          timeLine,
          memberCount,
          price,
        });

        res.json(result);
      } catch (error: any) {
        console.error('[Availability] Check error:', error);
        res.status(500).json({ error: 'CHECK_FAILED' });
      }
    },

    /**
     * 获取替代方案
     */
    getAlternatives(req: Request, res: Response) {
      try {
        const { activityTitle, failureType } = req.body;

        if (!activityTitle || !failureType) {
          res.status(400).json({ error: 'MISSING_PARAMS' });
          return;
        }

        const alternatives = getAlternativesForType(activityTitle, failureType);
        res.json({ alternatives });
      } catch (error: any) {
        console.error('[Availability] Alternatives error:', error);
        res.status(500).json({ error: 'ALTERNATIVES_FAILED' });
      }
    },
  };
}
