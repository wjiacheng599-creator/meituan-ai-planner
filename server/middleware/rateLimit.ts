/**
 * Rate Limiting Middleware
 *
 * Extracted from server/index.ts (lines 60-82)
 * Three tiers:
 *   generalLimiter  — 100 req/min (all routes)
 *   aiGenerateLimiter — 5 req/min (plan generation)
 *   aiChatLimiter    — 10 req/min (AI chat)
 */
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'TOO_MANY_REQUESTS' },
});

export const aiGenerateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI_GENERATE_RATE_LIMITED' },
});

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI_CHAT_RATE_LIMITED' },
});
