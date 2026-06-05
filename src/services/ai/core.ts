import { readRuntimeEnv, isBrowserRuntime } from '../runtimeEnv';
import { LRUCache } from '../../utils/lruCache';
import { hashString, estimateTokens } from './utils';
import {
  getAIProvider,
  DashScopeProvider,
  LongCatProvider,
  setAIProvider,
  resetAIProvider,
} from './provider';

// [PERF-OPT] AI response cache - cache responses for identical prompts (non-chat only)
export const aiResponseCache = new LRUCache<string>(500);

// Security: API Key only available on server side, never expose to client
// DASHSCOPE_API_KEY is read only in server environment (process.env)
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const USE_SERVER_PROXY = readRuntimeEnv('VITE_USE_SERVER_PROXY') !== 'false'; // Default true for security

// 支持的模型列表（按优先级排序）
const AVAILABLE_MODELS = ['qwen-plus', 'qwen-turbo', 'qwen-max'] as const;

type ModelName = (typeof AVAILABLE_MODELS)[number];

// 从环境变量读取当前模型，如果没设置或无效则使用默认
const getCurrentModel = (): ModelName => {
  const envModel = readRuntimeEnv('VITE_MODEL_NAME') || 'qwen-turbo';
  if (AVAILABLE_MODELS.includes(envModel as ModelName)) {
    return envModel as ModelName;
  }
  return 'qwen-turbo';
};

let currentModel = getCurrentModel();
let modelIndex = AVAILABLE_MODELS.indexOf(currentModel);

// 自动切换到下一个可用模型
const switchToNextModel = (): ModelName => {
  modelIndex = (modelIndex + 1) % AVAILABLE_MODELS.length;
  currentModel = AVAILABLE_MODELS[modelIndex];
  return currentModel;
};

// 获取当前使用的模型
const getModel = (): ModelName => currentModel;

const DASHSCOPE_TIMEOUT_MS = 30000;

// Prompt injection patterns (case-insensitive)
const INJECTION_PATTERNS = [
  // English patterns
  /ignore\s*(all\s*)?(previous|above)\s*(instructions?|directives?)/gi,
  /disregard\s*(all\s*)?(previous|above)\s*(instructions?|directives?)/gi,
  /forget\s*(all\s*)?(previous|your)\s*(instructions?|knowledge)/gi,
  /you\s*are\s*now\s*(a|an)?\s*/gi,
  /pretend\s*(you\s*are|to\s*be)/gi,
  /\bact\s*as\s*/gi,
  /new\s*role[:\s]/gi,
  /system\s*(prompt|message|instruction)/gi,
  /\{system\s*\}?/gi,
  // Chinese patterns
  /忽略.*(?:之前|上面|上述)/gi,
  /忽略之前(?:的)?(?:指令|指示|要求)/gi,
  /忘记.*(?:之前|一切|所有)/gi,
  /你现在?(是|变成|成为)/gi,
  /假装你?(是|变成|成为)/gi,
  /扮演.*(?:角色|身份)/gi,
  /系统提示/gi,
  /新角色/gi,
];

// Pattern for excessive repetition
const EXCESSIVE_REPETITION = /(.+?)\1{5,}/;

// Pattern for excessive special characters
const EXCESSIVE_SPECIAL_CHARS = /[^\w\s\u4e00-\u9fff]{30,}/;

/**
 * Sanitizes user input to prevent prompt injection attacks.
 * Detects common injection patterns and strips malicious parts.
 */
export function sanitizeUserInput(text: string, maxLength = 500): string {
  let sanitized = text;
  let hadInjection = false;

  // Check for injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn('[Security] Potential prompt injection detected, stripping malicious content');
      sanitized = sanitized.replace(pattern, ' ');
      hadInjection = true;
    }
  }

  // Check for excessive repetition
  if (EXCESSIVE_REPETITION.test(sanitized)) {
    console.warn('[Security] Excessive repetition detected, truncating');
    sanitized = sanitized.replace(EXCESSIVE_REPETITION, '$1');
    hadInjection = true;
  }

  // Check for excessive special characters
  if (EXCESSIVE_SPECIAL_CHARS.test(sanitized)) {
    console.warn('[Security] Excessive special characters detected, truncating');
    sanitized = sanitized.slice(
      0,
      sanitized.indexOf(sanitized.match(EXCESSIVE_SPECIAL_CHARS)?.[0] || '')
    );
    hadInjection = true;
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate to reasonable length
  if (sanitized.length > maxLength) {
    console.warn(`[Security] Input too long, truncating to ${maxLength} chars`);
    sanitized = sanitized.slice(0, maxLength);
  }

  if (hadInjection) {
    console.warn('[Security] User input was sanitized');
  }

  return sanitized;
}

// [PERF-OPT] Modified to support optional caching for non-chat calls
// Uses AI provider abstraction (DashScope/LongCat/Mock) via getAIProvider()
export async function callDashScope(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
  signal?: AbortSignal,
  cacheable: boolean = false
): Promise<string> {
  // [PERF-OPT] Check cache for cacheable calls
  if (cacheable) {
    const cacheKey = hashString(systemPrompt + userPrompt);
    if (aiResponseCache.has(cacheKey)) {
      return aiResponseCache.get(cacheKey)!;
    }
  }

  // [PERF-OPT] Estimate tokens and warn if excessive
  const estimatedTokens = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
  if (estimatedTokens > 4000) {
    console.warn(`[PERF-OPT] Large request detected: ~${estimatedTokens} tokens`);
  }

  // 通过 provider 抽象层调用 AI，支持自动降级
  const provider = getAIProvider();
  try {
    const content = await provider.chat({
      systemPrompt,
      userPrompt,
      jsonMode,
      signal,
      cacheable,
    });

    // [PERF-OPT] Cache the result if cacheable
    if (cacheable && content) {
      const cacheKey = hashString(systemPrompt + userPrompt);
      aiResponseCache.set(cacheKey, content);
    }

    return content;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] ${provider.name} 调用失败: ${errorMsg}`);

    // 级联降级：DashScope → LongCat
    if (provider.name !== 'longcat' && provider.name !== 'mock') {
      console.warn('[AI] 尝试降级到 LongCat...');
      try {
        const longCatProvider = new LongCatProvider();
        const content = await longCatProvider.chat({
          systemPrompt,
          userPrompt,
          jsonMode,
          signal,
          cacheable,
        });

        if (cacheable && content) {
          const cacheKey = hashString(systemPrompt + userPrompt);
          aiResponseCache.set(cacheKey, content);
        }

        console.log('[AI] LongCat 降级成功');
        return content;
      } catch (longCatError) {
        console.error(
          '[AI] LongCat 降级也失败:',
          longCatError instanceof Error ? longCatError.message : longCatError
        );
        throw error; // 抛出原始错误
      }
    }

    throw error;
  }
}

// [PERF-OPT] Streaming variant - uses AI provider abstraction
export async function callDashScopeStreaming(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
  jsonMode = false,
  signal?: AbortSignal
): Promise<string> {
  const provider = getAIProvider();
  try {
    return await provider.stream({
      systemPrompt,
      userPrompt,
      onChunk,
      jsonMode,
      signal,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] ${provider.name} 流式调用失败: ${errorMsg}`);

    // 如果当前不是 DashScope，尝试降级到 DashScope
    if (provider.name !== 'dashscope') {
      console.warn('[AI] 尝试降级到 DashScope 流式...');
      try {
        const dashScopeProvider = new DashScopeProvider();
        const result = await dashScopeProvider.stream({
          systemPrompt,
          userPrompt,
          onChunk,
          jsonMode,
          signal,
        });
        console.log('[AI] DashScope 流式降级成功');
        return result;
      } catch (dashScopeError) {
        console.error(
          '[AI] DashScope 流式降级也失败:',
          dashScopeError instanceof Error ? dashScopeError.message : dashScopeError
        );
        throw error;
      }
    }

    throw error;
  }
}
