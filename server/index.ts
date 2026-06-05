/**
 * server/index.ts — Express API Server
 *
 * Architecture (2026-05-18):
 *   Router → Controller → Service → Repository
 *
 * After refactoring: ~280 lines (was 826 lines)
 * - Rate limiting, auth, cookie → server/middleware/
 * - Business logic → server/services/
 * - Route handlers → server/controllers/
 * - AI streaming routes kept inline (complex SSE logic)
 */
import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';

import {
  chatWithCopilot,
  chatWithCopilotLocally,
  chatInHome,
  generateAIStory,
  generateAlternatives,
  generatePlan,
  generatePlanStreaming,
  type Activity,
  type CopilotMessage as AICopilotMessage,
  type Plan as AIPlan,
} from '../src/services/ai';
import { getServerRepository } from './store';
import type { PlannerTaskState } from '../src/types';
import proxyRouter from './api/proxy';
import speechRouter from './api/speechRecognize';
import visionRouter from './api/visionRecognize';
import {
  globalKnowledgeBase,
  initializeKnowledgeBase,
  type KnowledgeItem,
} from './knowledgeBase';
import { UserPreferenceManager, type UserPreference } from './userPreference';

// ── New layered imports ──────────────────────────────────────────────────────
import { generalLimiter, aiGenerateLimiter, aiChatLimiter } from './middleware/rateLimit';
import { signUserId, verifySignedUserId, parseCookie } from './middleware/cookie';
import { resolveUser, requireAuth } from './middleware/auth';
import { createPaymentController } from './controllers/paymentController';
import { createPlanController } from './controllers/planController';
import { createSessionController } from './controllers/sessionController';
import { PaymentService } from './services/paymentService';
import { PlanService } from './services/planService';
import { SessionService } from './services/sessionService';
import { OrderService } from './services/orderService';
import { createOrderController } from './controllers/orderController';
import { createAvailabilityController } from './controllers/availabilityController';
import { createFliggyController } from './controllers/fliggyController';
import { executeAgentOnServer } from './services/agentExecute';

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 8788);
const USER_COOKIE_NAME = 'mt_planner_uid';

// ── Initialize layers ─────────────────────────────────────────────────────────
const repository = getServerRepository();
const paymentService = new PaymentService(repository);
const planService = new PlanService(repository);
const sessionService = new SessionService(repository);
const orderService = new OrderService(repository);
const paymentController = createPaymentController(paymentService, orderService);
const planController = createPlanController(planService);
const sessionController = createSessionController(sessionService);
const orderController = createOrderController(orderService);
const availabilityController = createAvailabilityController();
const fliggyController = createFliggyController();
const globalPreferenceManager = new UserPreferenceManager(repository);

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeErrorMessage(error: unknown, fallback: string): string {
  if (process.env.NODE_ENV === 'production') return fallback;
  if (error instanceof Error) return error.message;
  return String(error);
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(generalLimiter);
app.use(express.json({ limit: '5mb' }));
app.use('/api', proxyRouter);
app.use('/api/speech', speechRouter);
app.use('/api/vision', visionRouter);

initializeKnowledgeBase().catch(console.error);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const signed = signUserId(userId);
    res.cookie(USER_COOKIE_NAME, signed, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    res.json({ userId, success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'REGISTRATION_FAILED') });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const cookies = parseCookie(req.headers.cookie);
    const signed = cookies[USER_COOKIE_NAME];
    if (!signed) { res.json({ authenticated: false }); return; }
    const userId = verifySignedUserId(signed);
    res.json({ authenticated: !!userId, userId: userId ?? null });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'AUTH_CHECK_FAILED') });
  }
});

// ─── Payment (refactored to controller) ───────────────────────────────────────
app.post('/api/payment/process', async (req, res) => paymentController.processPayment(req, res));
app.get('/api/payment/:transactionId', async (req, res) => paymentController.getPayment(req, res));

// ─── Orders ───────────────────────────────────────────────────────────
app.post('/api/orders', requireAuth(async (req, res) => orderController.createOrder(req, res)));
app.get('/api/orders', requireAuth(async (req, res) => orderController.getOrders(req, res)));
app.get('/api/orders/:id', requireAuth(async (req, res) => orderController.getOrderDetail(req, res)));
app.post('/api/orders/:id/cancel', requireAuth(async (req, res) => orderController.cancelOrder(req, res)));
app.post('/api/orders/:id/refund', requireAuth(async (req, res) => orderController.requestRefund(req, res)));
app.delete('/api/orders/:id', requireAuth(async (req, res) => orderController.deleteOrder(req, res)));

// ─── Availability（预检服务）───────────────────────────────────────────
app.post('/api/availability/check', (req, res) => availabilityController.checkAvailability(req, res));
app.post('/api/availability/alternatives', (req, res) => availabilityController.getAlternatives(req, res));

// ─── Fliggy（飞猪旅行数据）─────────────────────────────────────────────
app.get('/api/fliggy/hotels', async (req, res) => fliggyController.searchHotels(req, res));
app.get('/api/fliggy/poi', async (req, res) => fliggyController.searchPOI(req, res));
app.get('/api/fliggy/search', async (req, res) => fliggyController.keywordSearch(req, res));

// ─── Plans (refactored to controller — except streaming) ──────────────────────
app.post('/api/plans/generate', aiGenerateLimiter, async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const query = String(req.body.query || '').trim();
    const city = typeof req.body?.city === 'string' ? req.body.city : undefined;
    const travelDNA = req.body?.travelDNA || undefined;
    const context = req.body?.context || undefined;
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined;
    if (!query) { res.status(400).json({ error: 'Query is required' }); return; }

    const accept = req.headers['accept'] || '';
    const useSSE = accept.includes('text/event-stream') || req.query.stream === 'true';

    if (useSSE) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const plan = await generatePlanStreaming(query, city, (chunk: string) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }, undefined, travelDNA, context);
        const saved = await repository.saveGeneratedPlan({ userId: user.id, query, plan, sessionId });
        res.write(`data: ${JSON.stringify({ done: true, plan: { ...plan, id: saved.taskState.planId }, taskState: saved.taskState, session: saved.session })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: safeErrorMessage(error, 'PLAN_GENERATION_FAILED') })}\n\n`);
      }
      res.end();
    } else {
      const plan = await generatePlan(query, city, undefined, travelDNA, context);
      const saved = await repository.saveGeneratedPlan({ userId: user.id, query, plan, sessionId });
      res.json({
        plan: { ...plan, id: saved.taskState.planId },
        taskState: saved.taskState,
        session: saved.session,
      });
    }
  } catch (error) {
    console.error('[plan] generate failed:', error);
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_GENERATION_FAILED') });
  }
});

// ─── Agent Execute (SSE) ─────────────────────────────────────────────────────
app.post('/api/agent/execute', aiGenerateLimiter, async (req, res) => {
  const ac = new AbortController();
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    ac.abort();
  });

  const safeWrite = (data: string) => {
    if (!clientDisconnected && !res.writableEnded) {
      try { res.write(data); } catch { /* client gone */ }
    }
  };

  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { activities, planTitle, city, peopleCount, weather } = req.body || {};
    if (!activities || !Array.isArray(activities) || !planTitle) {
      res.status(400).json({ error: 'activities and planTitle are required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const result = await executeAgentOnServer(
      { activities, planTitle, city: city || '北京', peopleCount: peopleCount || 1, weather },
      (step) => { safeWrite(`data: ${JSON.stringify({ type: 'step', step })}\n\n`); },
      ac.signal,
    );

    safeWrite(`data: ${JSON.stringify({ type: 'done', result })}\n\n`);
    res.end();
  } catch (error) {
    if (clientDisconnected) return;
    const msg = error instanceof Error ? error.message : 'AGENT_EXECUTE_FAILED';
    safeWrite(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    res.end();
  }
});

app.get('/api/plans', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    await planController.getPlans(req, res);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLANS_GET_FAILED') });
  }
});
app.get('/api/plans/:id', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    await planController.getPlanById(req, res);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_GET_FAILED') });
  }
});
app.delete('/api/plans/:id', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    await planController.deletePlan(req, res);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_DELETE_FAILED') });
  }
});
app.get('/api/plans/:id/share', async (req, res) => {
  try {
    // 分享链接允许未认证访问
    await planController.sharePlan(req, res);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_SHARE_FAILED') });
  }
});

// ─── Sessions (refactored to controller) ──────────────────────────────────────
app.get('/api/sessions', async (req, res) => sessionController.getSessions(req, res));
app.post('/api/sessions', async (req, res) => sessionController.createSession(req, res));
app.delete('/api/sessions/:id', async (req, res) => sessionController.deleteSession(req, res));

// ─── Knowledge Base ───────────────────────────────────────────────────────────
app.get('/api/knowledge/search', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const q = String(req.query.q || '');
    if (!q) { res.status(400).json({ error: 'Query required' }); return; }
    const results = globalKnowledgeBase.search(q);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'KB_SEARCH_FAILED') });
  }
});

app.post('/api/knowledge/add', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const { content, category, tags, city } = req.body || {};
    if (!content || typeof content !== 'string') { res.status(400).json({ error: 'Content required (string)' }); return; }
    if (content.length > 2000) { res.status(400).json({ error: 'Content too long (max 2000)' }); return; }
    const validCategories = new Set(['restaurant', 'attraction', 'hotel', 'activity', 'general']);
    const safeCategory = validCategories.has(category) ? category : 'general';
    const safeTags = Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string').slice(0, 20) : [];
    const safeCity = typeof city === 'string' ? city.slice(0, 50) : 'unknown';
    const id = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await globalKnowledgeBase.addItem({
      id,
      title: String(content).slice(0, 50),
      content: content.slice(0, 2000),
      category: safeCategory as 'restaurant' | 'attraction' | 'hotel' | 'activity',
      city: safeCity,
      tags: safeTags,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'KB_ADD_FAILED') });
  }
});

// ─── Preferences ─────────────────────────────────────────────────────────────
app.get('/api/preferences', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const prefs = await globalPreferenceManager.getPreferences(user.id);
    res.json({ preferences: prefs });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PREFERENCES_GET_FAILED') });
  }
});

app.post('/api/preferences', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const prefs = (req.body || {}) as Partial<UserPreference>;
    await globalPreferenceManager.updatePreferences(user.id, prefs);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PREFERENCES_UPDATE_FAILED') });
  }
});

app.post('/api/preferences/learn', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const { action, context, price } = req.body || {};
    if (action) {
      await globalPreferenceManager.learnFromActivity(user.id, {
        title: action,
        tags: context ? String(context).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        price: typeof price === 'number' ? price : 0,
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PREFERENCES_LEARN_FAILED') });
  }
});

// ─── Behavior Tracking ───────────────────────────────────────────────────────
app.post('/api/behavior/track', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { type, planId, activityId, metadata } = req.body || {};
    if (!type || typeof type !== 'string') {
      res.status(400).json({ error: 'type is required (string)' });
      return;
    }

    const validTypes = new Set(['select', 'skip', 'complete', 'cancel', 'vote', 'search', 'share']);
    if (!validTypes.has(type)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${[...validTypes].join(', ')}` });
      return;
    }

    await repository.trackBehaviorEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: user.id,
      type,
      planId: typeof planId === 'string' ? planId : undefined,
      activityId: typeof activityId === 'string' ? activityId : undefined,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      timestamp: Date.now(),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'BEHAVIOR_TRACK_FAILED') });
  }
});

app.get('/api/behavior/stats', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const stats = await repository.getBehaviorStats(user.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'BEHAVIOR_STATS_FAILED') });
  }
});

// 获取用户行为事件（用于画像构建）
app.get('/api/behavior/events', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const limit = parseInt(String(req.query.limit || '50'), 10);
    const type = req.query.type as string | undefined;
    const since = req.query.since ? parseInt(String(req.query.since), 10) : undefined;

    const events = await repository.getBehaviorEvents(user.id, { limit, type, since });
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'BEHAVIOR_EVENTS_FAILED') });
  }
});

// 获取统一用户画像（合并偏好 + 行为）
app.get('/api/profile/unified', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const [prefs, events, stats] = await Promise.all([
      globalPreferenceManager.getPreferences(user.id),
      repository.getBehaviorEvents(user.id, { limit: 100 }),
      repository.getBehaviorStats(user.id),
    ]);

    res.json({
      preferences: prefs,
      behaviorEvents: events,
      behaviorStats: stats,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'UNIFIED_PROFILE_FAILED') });
  }
});

// ─── Home Chat ───────────────────────────────────────────────────────────────
app.post('/api/home/chat', aiChatLimiter, async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { message, city, profiles, recentPlans, currentHour } = req.body || {};
    if (!message) { res.status(400).json({ error: 'message is required' }); return; }

    const result = await chatInHome(message, {
      city: city || '北京',
      profiles: profiles || [],
      recentPlans: recentPlans || [],
      currentHour: currentHour || new Date().getHours(),
    });

    res.json(result);
  } catch (error) {
    console.error('[home/chat] chat failed:', error);
    res.status(500).json({ error: safeErrorMessage(error, 'CHAT_FAILED') });
  }
});

// ─── Copilot Chat ─────────────────────────────────────────────────────────────
app.post('/api/copilot/chat', aiChatLimiter, async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { planId, message, history, context } = req.body || {};
    if (!message) { res.status(400).json({ error: 'message is required' }); return; }

    let plan: AIPlan | null = null;
    if (planId) {
      try {
        const planRecord = await repository.getPlanById(planId);
        if (planRecord && planRecord.userId === user.id) {
          plan = planRecord.plan;
        }
      } catch (e) {
        // planId 无效时忽略，继续用 context
        console.warn('[copilot] plan not found, using context only:', planId);
      }
    }

    const messages: AICopilotMessage[] = (history || []).map((h: { role: string; content: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }));
    messages.push({ role: 'user', content: message });

    // 直接调用 chatWithCopilotLocally，避免 server fallback 无限递归
    const reply = await chatWithCopilotLocally(message, {
      planTitle: plan?.title || context?.planTitle || '行程规划',
      activities: plan?.activities?.map((a: Activity) => a.title) || context?.activities || [],
      teamProfiles: context?.teamProfiles,
      strategy: context?.strategy,
      weather: context?.weather,
      currentActivities: plan?.activities || context?.currentActivities,
    }, messages);
    res.json(reply);
  } catch (error) {
    console.error('[copilot] chat failed:', error);
    res.status(500).json({ error: safeErrorMessage(error, 'COPILOT_CHAT_FAILED') });
  }
});

// ─── Story Generation ─────────────────────────────────────────────────────────
app.post('/api/story/generate', aiGenerateLimiter, async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { planId, template } = req.body || {};
    if (!planId) { res.status(400).json({ error: 'planId required' }); return; }

    const planRecord = await repository.getPlanById(planId);
    if (!planRecord || planRecord.userId !== user.id) { res.status(404).json({ error: 'Plan not found' }); return; }
    const plan = planRecord.plan;

    const story = await generateAIStory({
      planTitle: plan.title || '行程',
      activities: plan.activities?.map((a: Activity) => a.title) || [],
      checkInCount: plan.activities?.length || 0,
      template,
    });
    res.json({ story });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'STORY_GENERATION_FAILED') });
  }
});

// ─── Stories (get/save) ──────────────────────────────────────────────────────
app.get('/api/stories/:planId', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const story = await repository.getStoryRecord(user.id, req.params.planId);
    if (!story) { res.json(null); return; }
    res.json(story.story);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'STORY_GET_FAILED') });
  }
});

app.post('/api/stories/:planId', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    await repository.saveStoryRecord({ userId: user.id, planId: req.params.planId, story: req.body });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'STORY_SAVE_FAILED') });
  }
});

// ─── Shares ──────────────────────────────────────────────────────────────────
app.post('/api/shares', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const record = await repository.createShareRecord({
      userId: user.id,
      plan: req.body.plan,
      profiles: req.body.profiles || [],
      taskState: req.body.taskState,
    });
    res.json({ shareSlug: record.shareSlug, shareUrl: `/share/${record.shareSlug}` });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'SHARE_CREATE_FAILED') });
  }
});

app.get('/api/shares/:slug', async (req, res) => {
  try {
    const record = await repository.getShareRecord(req.params.slug);
    if (!record) { res.status(404).json({ error: 'Share not found' }); return; }
    res.json({ plan: record.snapshot.plan, profiles: record.snapshot.profiles, taskState: record.snapshot.taskState });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'SHARE_GET_FAILED') });
  }
});

// ─── Collaboration Votes（多用户协作投票，持久化到 SQLite）─────────────────

// 提交投票（支持活动级投票）
app.post('/api/shares/:slug/vote', async (req, res) => {
  try {
    const { slug } = req.params;
    const { voterName, vote, suggestion, activityId, voterAvatar, weight } = req.body;

    if (!voterName || !vote) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }

    if (!['approve', 'reject', 'suggest', 'suggest_change'].includes(vote)) {
      res.status(400).json({ error: 'INVALID_VOTE_TYPE' });
      return;
    }

    const voteEntry = {
      id: `vote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      voterName,
      activityId: activityId || undefined,
      voterAvatar: voterAvatar || undefined,
      vote: vote === 'suggest_change' ? 'suggest' : vote,
      suggestion: suggestion || undefined,
      weight: typeof weight === 'number' ? weight : 1.0,
      createdAt: Date.now(),
    };

    await repository.upsertShareVote(slug, voteEntry);
    const votes = await repository.getShareVotes(slug);
    res.json({ success: true, vote: voteEntry, votes });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'VOTE_FAILED') });
  }
});

// 获取投票结果
app.get('/api/shares/:slug/votes', async (req, res) => {
  try {
    const { slug } = req.params;
    const votes = await repository.getShareVotes(slug);
    res.json({ votes, summary: getVoteSummary(votes) });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'VOTES_GET_FAILED') });
  }
});

function getVoteSummary(votes: Array<{ vote: string; voterName: string; suggestion?: string }>) {
  const approve = votes.filter(v => v.vote === 'approve').length;
  const reject = votes.filter(v => v.vote === 'reject').length;
  const suggestChange = votes.filter(v => v.vote === 'suggest').length;
  const total = votes.length;
  const suggestions = votes.filter(v => v.suggestion).map(v => ({
    voterName: v.voterName, suggestion: v.suggestion!,
  }));
  return {
    total, approve, reject, suggestChange,
    approveRate: total > 0 ? Math.round((approve / total) * 100) : 0,
    consensus: approve > reject ? '多数赞成' : reject > approve ? '多数反对' : '意见分歧',
    suggestions,
  };
}

// ─── Vote-triggered AI Optimize ──────────────────────────────────────────────
app.post('/api/shares/:slug/optimize', aiGenerateLimiter, async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { planId, controversialActivities, allSuggestions } = req.body || {};
    if (!planId || !controversialActivities?.length) {
      res.status(400).json({ error: 'No controversial activities to optimize' });
      return;
    }

    // 从数据库获取原 plan
    const planRecord = await repository.getPlanById(planId);
    if (!planRecord) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    const originalPlan = planRecord.plan;

    // 构建 AI prompt：只替换有争议的活动
    const controversialList = controversialActivities.map((a: { title: string; rejectRate: number; suggestions: Array<{ suggestion: string }> }) => {
      const sugs = a.suggestions.map(s => s.suggestion).join('；');
      return `- ${a.title}（反对率 ${a.rejectRate}%）：${sugs || '无具体建议'}`;
    }).join('\n');

    const systemPrompt = `你是美团本地生活 AI 规划师。团队投票后发现以下活动有争议，请为每个争议活动生成 1 个替代方案。

争议活动：
${controversialList}

要求：
1. 只替换有争议的活动，保留其他活动不变
2. 替代方案要满足团队成员的修改建议
3. 返回 JSON 格式：{ "replacements": [{ "originalId": "原活动ID", "newTitle": "新活动名", "newDescription": "推荐理由", "newPrice": 价格 }] }
4. 新活动必须是${originalPlan.city || '当前城市'}的真实商家/景点`;

    const { callDashScope } = await import('../src/services/ai/core');
    const rawText = await callDashScope(systemPrompt, '请为上述争议活动生成替代方案。', true);

    let replacements: Array<{ originalId: string; newTitle: string; newDescription: string; newPrice: number }> = [];
    try {
      const parsed = JSON.parse(rawText);
      replacements = parsed.replacements || [];
    } catch {
      // AI 返回格式异常，使用简单替换
      for (const act of controversialActivities) {
        replacements.push({
          originalId: act.id,
          newTitle: `替代：${act.title}`,
          newDescription: '根据团队建议替换',
          newPrice: 0,
        });
      }
    }

    // 应用替换
    const updatedActivities = originalPlan.activities.map(act => {
      const replacement = replacements.find(r => r.originalId === act.id);
      if (replacement) {
        return {
          ...act,
          title: replacement.newTitle,
          description: replacement.newDescription,
          price: replacement.newPrice || act.price,
          tags: [...(act.tags || []), '团队优化'],
        };
      }
      return act;
    });

    const updatedPlan = {
      ...originalPlan,
      activities: updatedActivities,
      totalPrice: updatedActivities.reduce((sum, a) => sum + (a.price || 0), 0),
      strategy: `${originalPlan.strategy || ''}（团队投票优化）`,
    };

    // 保存更新后的 plan
    await repository.upsertPlanRecord({ userId: user.id, plan: updatedPlan, sourceQuery: 'vote_optimize' });

    res.json({ success: true, updatedPlan, replacements });
  } catch (error) {
    console.error('[vote-optimize] Failed:', error);
    res.status(500).json({ error: safeErrorMessage(error, 'OPTIMIZE_FAILED') });
  }
});

// ─── Alternatives ─────────────────────────────────────────────────────────────
app.post('/api/alternatives', aiGenerateLimiter, async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { planId, activityId, reason } = req.body || {};
    if (!planId || !activityId) { res.status(400).json({ error: 'planId and activityId required' }); return; }

    const planRecord = await repository.getPlanById(planId);
    if (!planRecord || planRecord.userId !== user.id) { res.status(404).json({ error: 'Plan not found' }); return; }
    const plan = planRecord.plan;
    const activity = plan?.activities?.find((a: Activity) => a.id === activityId);
    if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }

    const result = await generateAlternatives(activity, reason || '请提供替代方案');
    res.json({ alternatives: result });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'ALTERNATIVES_FAILED') });
  }
});

// ─── Bootstrap（统一处理 GET/POST，兼容 /api/bootstrap 和 /api/session/bootstrap）──
async function handleBootstrap(req: express.Request, res: express.Response) {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const payload = await repository.getBootstrapPayload(user.id, { page, limit });

    res.json({
      profiles: payload.profiles,
      savedPlans: payload.savedPlans,
      plannerTaskStates: payload.plannerTaskStates,
      sessions: payload.sessions,
      total: payload.total,
      pagination: { hasMore: payload.total > page * limit },
      preferences: await globalPreferenceManager.getPreferences(user.id),
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'BOOTSTRAP_FAILED') });
  }
}

app.get('/api/bootstrap', handleBootstrap);
app.get('/api/session/bootstrap', handleBootstrap);
app.post('/api/session/bootstrap', handleBootstrap);

// ─── Sync Routes (前端批量同步) ───────────────────────────────────────────────
app.post('/api/profiles/sync', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const rawProfiles = req.body?.profiles;
    if (!Array.isArray(rawProfiles)) { res.status(400).json({ error: 'profiles must be an array' }); return; }
    if (rawProfiles.length > 50) { res.status(400).json({ error: 'Too many profiles (max 50)' }); return; }
    const profiles = await repository.replaceProfiles({ userId: user.id, profiles: rawProfiles });
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PROFILES_SYNC_FAILED') });
  }
});

app.post('/api/sessions/sync', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const sessions = await repository.replaceSessions({ userId: user.id, sessions: req.body?.sessions || [] });
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'SESSIONS_SYNC_FAILED') });
  }
});

app.post('/api/task-states/sync', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const taskStates = await repository.replacePlannerTaskStates({ taskStates: req.body?.taskStates || [] });
    res.json({ taskStates });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'TASK_STATES_SYNC_FAILED') });
  }
});

// ─── Profiles ─────────────────────────────────────────────────────────────────
app.get('/api/profiles', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const allPayload = await repository.getBootstrapPayload(user.id, { page: 1, limit: 1000 });
    res.json({ profiles: allPayload.profiles });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PROFILES_GET_FAILED') });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const allPayload = await repository.getBootstrapPayload(user.id, { page: 1, limit: 1000 });
    const newProfile = { id: `profile_${Date.now()}`, ...req.body };
    const updated = await repository.replaceProfiles({ userId: user.id, profiles: [...allPayload.profiles, newProfile as import('../src/types').PersonProfile] });
    res.json({ profile: updated.find(p => p.id === newProfile.id) ?? newProfile });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PROFILE_SAVE_FAILED') });
  }
});

app.put('/api/profiles/:id', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const allPayload = await repository.getBootstrapPayload(user.id, { page: 1, limit: 1000 });
    const updated = allPayload.profiles.map(p => p.id === req.params.id ? { ...p, ...req.body } : p);
    const result = await repository.replaceProfiles({ userId: user.id, profiles: updated });
    const profile = result.find(p => p.id === req.params.id);
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PROFILE_UPDATE_FAILED') });
  }
});

app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const allPayload = await repository.getBootstrapPayload(user.id, { page: 1, limit: 1000 });
    const filtered = allPayload.profiles.filter(p => p.id !== req.params.id);
    await repository.replaceProfiles({ userId: user.id, profiles: filtered });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PROFILE_DELETE_FAILED') });
  }
});

app.post('/api/profiles/replace', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const profiles = await repository.replaceProfiles({ userId: user.id, profiles: req.body || [] });
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PROFILES_REPLACE_FAILED') });
  }
});

// ─── Saved Plans ──────────────────────────────────────────────────────────────
app.get('/api/saved-plans', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const payload = await repository.getBootstrapPayload(user.id, { page: 1, limit: 100 });
    res.json({ plans: payload.savedPlans });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'SAVED_PLANS_GET_FAILED') });
  }
});

app.post('/api/saved-plans', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const record = await repository.upsertPlanRecord({ userId: user.id, plan: req.body.plan, sourceQuery: req.body.sourceQuery });
    res.json({ plan: record.plan });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_SAVE_FAILED') });
  }
});

app.delete('/api/saved-plans/:id', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const record = await repository.getPlanById(req.params.id);
    if (!record || record.userId !== user.id) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    const deleted = await repository.deletePlan(req.params.id);
    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_DELETE_FAILED') });
  }
});

// ─── Plans Upsert（前端 upsertPlanViaServer 调用）───────────────────────────
app.post('/api/plans/upsert', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const record = await repository.upsertPlanRecord({ userId: user.id, plan: req.body.plan, sourceQuery: req.body.sourceQuery });
    res.json({ plan: record.plan });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'PLAN_UPSERT_FAILED') });
  }
});

// ─── Task States ──────────────────────────────────────────────────────────────
app.patch('/api/task-states/:id/activities', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const state = await repository.getTaskStateByPlanId(req.params.id);
    if (!state) { res.status(404).json({ error: 'Not found' }); return; }
    const updated: PlannerTaskState = { ...state, ...req.body };
    await repository.replacePlannerTaskStates({ taskStates: [updated] });
    res.json({ taskState: updated });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'TASK_STATE_UPDATE_FAILED') });
  }
});

app.patch('/api/task-states/:id/book', async (req, res) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const { activityId } = req.body || {};
    if (!activityId) { res.status(400).json({ error: 'activityId required' }); return; }
    const state = await repository.getTaskStateByPlanId(req.params.id);
    if (!state) { res.status(404).json({ error: 'Not found' }); return; }
    const booked = new Set(state.bookedActivityIds || []);
    booked.add(activityId);
    const updated: PlannerTaskState = { ...state, bookedActivityIds: Array.from(booked) };
    await repository.replacePlannerTaskStates({ taskStates: [updated] });
    res.json({ taskState: updated });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 'BOOK_FAILED') });
  }
});

// ─── Executions（前端 executePlanViaServer 调用）────────────────────────────
app.post('/api/executions', aiGenerateLimiter, async (req, res) => {
  const ac = new AbortController();
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    ac.abort();
  });

  const safeWrite = (data: string) => {
    if (!clientDisconnected && !res.writableEnded) {
      try { res.write(data); } catch { /* client gone */ }
    }
  };

  try {
    const user = await resolveUser(req, res);
    if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const { plan, activityIds, peopleCount } = req.body || {};
    if (!plan) { res.status(400).json({ error: 'Plan required' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const result = await executeAgentOnServer(
      { activities: plan.activities || [], planTitle: plan.title || '行程', city: plan.city || '北京', peopleCount: peopleCount || 1 },
      (step) => { safeWrite(`data: ${JSON.stringify({ type: 'step', step })}\n\n`); },
      ac.signal,
    );

    safeWrite(`data: ${JSON.stringify({ type: 'done', result })}\n\n`);
    res.end();
  } catch (error) {
    if (clientDisconnected) return;
    const msg = error instanceof Error ? error.message : 'EXECUTION_FAILED';
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    } else {
      safeWrite(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      res.end();
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`[api] listening on http://0.0.0.0:${port}\n`);
});
