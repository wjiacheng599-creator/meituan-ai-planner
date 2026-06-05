/**
 * AI Provider 抽象层
 *
 * 级联降级策略：
 *   DashScope (qwen-plus → qwen3-turbo → qwen-turbo → qwen-max → qwen3-plus)
 *   → LongCat (LongCat-2.0-Preview)
 *   → Mock (兜底)
 *
 * 智能错误处理：
 * - 403/429 (额度耗尽/限流) → 立即跳到下一个 Provider
 * - 模型级错误 → 同 Provider 内切换模型
 * - 健康状态追踪 → 短期内不重试已知失败的模型
 */

import { LRUCache } from '../../utils/lruCache';
import { hashString, estimateTokens } from './utils';
import { readRuntimeEnv } from '../runtimeEnv';

// ── 接口定义 ──

export interface AIChatOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  signal?: AbortSignal;
  cacheable?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AIStreamOptions extends AIChatOptions {
  onChunk: (chunk: string) => void;
}

export interface AIProvider {
  readonly name: string;
  chat(options: AIChatOptions): Promise<string>;
  stream(options: AIStreamOptions): Promise<string>;
}

// ── 响应缓存 ──

const responseCache = new LRUCache<string>(500);

function getCachedResult(key: string): string | undefined {
  return responseCache.get(key);
}

function setCachedResult(key: string, value: string): void {
  responseCache.set(key, value);
}

// ── 模型健康状态追踪 ──

interface ModelHealth {
  model: string;
  provider: string;
  lastFailure: number;
  failureCount: number;
  errorType: 'quota' | 'rate_limit' | 'model_error' | 'unknown';
}

const modelHealthMap = new Map<string, ModelHealth>();
const HEALTH_COOLDOWN_MS = 5 * 60 * 1000; // 5 分钟冷却期

function getModelHealthKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

function isModelHealthy(provider: string, model: string): boolean {
  const key = getModelHealthKey(provider, model);
  const health = modelHealthMap.get(key);
  if (!health) return true;

  // 冷却期过后重试
  if (Date.now() - health.lastFailure > HEALTH_COOLDOWN_MS) {
    modelHealthMap.delete(key);
    return true;
  }

  // 额度耗尽错误：冷却期内不重试
  if (health.errorType === 'quota') return false;

  // 限流错误：失败次数 < 3 时仍可尝试
  if (health.errorType === 'rate_limit') return health.failureCount < 3;

  return true;
}

function recordModelFailure(
  provider: string,
  model: string,
  errorType: ModelHealth['errorType']
): void {
  const key = getModelHealthKey(provider, model);
  const existing = modelHealthMap.get(key);
  modelHealthMap.set(key, {
    model,
    provider,
    lastFailure: Date.now(),
    failureCount: (existing?.failureCount || 0) + 1,
    errorType,
  });
}

function classifyError(status: number, body: string): ModelHealth['errorType'] {
  if (
    status === 403 ||
    body.includes('free tier') ||
    body.includes('exhausted') ||
    body.includes('额度')
  ) {
    return 'quota';
  }
  if (status === 429 || body.includes('rate limit') || body.includes('throttle')) {
    return 'rate_limit';
  }
  if (status >= 500) {
    return 'model_error';
  }
  return 'unknown';
}

// ── DashScope Provider ──

const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_TIMEOUT_MS = 30000;

// 模型优先级：免费/便宜 → 付费/强大
const DASHSCOPE_MODELS = [
  'qwen-turbo', // 免费额度最多，优先使用
  'qwen-plus', // 备选
  'qwen-max', // 最强模型
  'qwen3-plus', // 新一代均衡模型
] as const;
type DashScopeModel = (typeof DASHSCOPE_MODELS)[number];

export class DashScopeProvider implements AIProvider {
  readonly name = 'dashscope';
  private currentModelIndex = 0;

  private getModel(): DashScopeModel {
    return DASHSCOPE_MODELS[this.currentModelIndex];
  }

  private switchModel(): DashScopeModel | null {
    // 跳过不健康的模型
    for (let i = this.currentModelIndex + 1; i < DASHSCOPE_MODELS.length; i++) {
      if (isModelHealthy('dashscope', DASHSCOPE_MODELS[i])) {
        this.currentModelIndex = i;
        return DASHSCOPE_MODELS[i];
      }
    }
    return null; // 所有模型都不可用
  }

  private getApiKey(): string {
    if (typeof window !== 'undefined') {
      throw new Error('DIRECT_API_CALL_NOT_ALLOWED');
    }
    const apiKey =
      typeof process !== 'undefined' && process.env ? process.env.DASHSCOPE_API_KEY : '';
    if (!apiKey) throw new Error('NO_API_KEY');
    const invalidPatterns = ['test_', 'your_', 'placeholder', 'xxx', 'example'];
    const lowerKey = apiKey.toLowerCase();
    if (invalidPatterns.some((pattern) => lowerKey.includes(pattern))) {
      throw new Error('NO_API_KEY');
    }
    return apiKey;
  }

  private buildBody(options: AIChatOptions, stream = false): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.getModel(),
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream,
    };
    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }
    return body;
  }

  async chat(options: AIChatOptions): Promise<string> {
    const apiKey = this.getApiKey();

    // 缓存检查
    if (options.cacheable) {
      const cacheKey = hashString(options.systemPrompt + options.userPrompt);
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < DASHSCOPE_MODELS.length; attempt++) {
      if (options.signal?.aborted) throw new Error('AbortError');

      const model = this.getModel();

      // 跳过不健康的模型
      if (!isModelHealthy('dashscope', model)) {
        const next = this.switchModel();
        if (!next) break;
        continue;
      }

      try {
        const combinedSignal = options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(DASHSCOPE_TIMEOUT_MS)])
          : AbortSignal.timeout(DASHSCOPE_TIMEOUT_MS);

        const response = await fetch(DASHSCOPE_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(this.buildBody(options, false)),
          signal: combinedSignal,
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            if (options.cacheable) {
              setCachedResult(hashString(options.systemPrompt + options.userPrompt), content);
            }
            return content;
          }
        }

        const errText = await response.text().catch(() => '');
        const errorType = classifyError(response.status, errText);
        console.warn(`[DashScope] ${model} 失败: ${response.status} (${errorType})`);

        // 记录失败
        recordModelFailure('dashscope', model, errorType);

        // 额度耗尽 → 立即跳到下一个 Provider（不继续尝试其他 DashScope 模型）
        if (errorType === 'quota') {
          console.warn('[DashScope] 额度耗尽，跳到备用 Provider');
          throw new Error('DASHSCOPE_QUOTA_EXHAUSTED');
        }

        // 其他错误 → 尝试下一个模型
        const next = this.switchModel();
        if (!next) break;
        lastError = new Error(`API 请求失败: ${response.status}`);
      } catch (error) {
        if (error instanceof Error && error.message === 'DASHSCOPE_QUOTA_EXHAUSTED') {
          throw error; // 直接抛出，让上层处理
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        const next = this.switchModel();
        if (!next) break;
      }
    }

    throw lastError || new Error('DashScope 所有模型调用失败');
  }

  async stream(options: AIStreamOptions): Promise<string> {
    const apiKey = this.getApiKey();

    for (let attempt = 0; attempt < DASHSCOPE_MODELS.length; attempt++) {
      if (options.signal?.aborted) throw new Error('AbortError');

      const model = this.getModel();

      if (!isModelHealthy('dashscope', model)) {
        const next = this.switchModel();
        if (!next) break;
        continue;
      }

      try {
        const combinedSignal = options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(DASHSCOPE_TIMEOUT_MS * 2)])
          : AbortSignal.timeout(DASHSCOPE_TIMEOUT_MS * 2);

        const response = await fetch(DASHSCOPE_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(this.buildBody(options, true)),
          signal: combinedSignal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const errorType = classifyError(response.status, errText);
          recordModelFailure('dashscope', model, errorType);

          if (errorType === 'quota') {
            throw new Error('DASHSCOPE_QUOTA_EXHAUSTED');
          }

          const next = this.switchModel();
          if (!next) break;
          continue;
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split('\n')) {
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const delta = JSON.parse(dataStr).choices?.[0]?.delta?.content;
                  if (delta) {
                    fullContent += delta;
                    options.onChunk(delta);
                  }
                } catch {
                  /* skip malformed */
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        return fullContent;
      } catch (error) {
        if (error instanceof Error && error.message === 'DASHSCOPE_QUOTA_EXHAUSTED') {
          throw error;
        }
        const next = this.switchModel();
        if (!next) break;
      }
    }

    throw new Error('DashScope 所有模型调用失败');
  }
}

// ── LongCat Provider（美团 LongCat，备用模型） ──

const LONGCAT_BASE_URL = 'https://api.longcat.chat/openai/v1/chat/completions';
const LONGCAT_TIMEOUT_MS = 60000;
const LONGCAT_MODELS = ['LongCat-2.0-Preview'] as const;

export class LongCatProvider implements AIProvider {
  readonly name = 'longcat';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      readRuntimeEnv('VITE_LONGCAT_API_KEY') ||
      readRuntimeEnv('LONGCAT_API_KEY') ||
      (typeof process !== 'undefined' && process.env ? (process.env.LONGCAT_API_KEY ?? '') : '');
  }

  async chat(options: AIChatOptions): Promise<string> {
    if (!this.apiKey) throw new Error('LONGCAT_API_KEY_NOT_CONFIGURED');

    if (options.cacheable) {
      const cacheKey = hashString(options.systemPrompt + options.userPrompt);
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;
    }

    const combinedSignal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(LONGCAT_TIMEOUT_MS)])
      : AbortSignal.timeout(LONGCAT_TIMEOUT_MS);

    const body: Record<string, unknown> = {
      model: LONGCAT_MODELS[0],
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    };
    if (options.jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(LONGCAT_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const errorType = classifyError(response.status, errText);
      recordModelFailure('longcat', LONGCAT_MODELS[0], errorType);
      throw new Error(`LongCat API 请求失败: ${response.status} - ${errText.slice(0, 100)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LongCat 返回空内容');

    if (options.cacheable) {
      setCachedResult(hashString(options.systemPrompt + options.userPrompt), content);
    }
    return content;
  }

  async stream(options: AIStreamOptions): Promise<string> {
    if (!this.apiKey) throw new Error('LONGCAT_API_KEY_NOT_CONFIGURED');

    const combinedSignal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(LONGCAT_TIMEOUT_MS * 2)])
      : AbortSignal.timeout(LONGCAT_TIMEOUT_MS * 2);

    const body: Record<string, unknown> = {
      model: LONGCAT_MODELS[0],
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    };
    if (options.jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(LONGCAT_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      recordModelFailure('longcat', LONGCAT_MODELS[0], classifyError(response.status, errText));
      throw new Error(`LongCat API 请求失败: ${response.status}`);
    }
    if (!response.body) throw new Error('No response body for streaming');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const delta = JSON.parse(dataStr).choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                options.onChunk(delta);
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }
}

// ── Mock Provider（测试用） ──

export class MockProvider implements AIProvider {
  readonly name = 'mock';

  async chat(options: AIChatOptions): Promise<string> {
    await new Promise((r) => setTimeout(r, 500));
    return JSON.stringify({
      title: '示例行程',
      activities: [
        {
          title: '午餐',
          type: 'food',
          timeLine: '12:00-13:00',
          price: 80,
          description: '附近热门餐厅',
        },
        {
          title: '休闲活动',
          type: 'activity',
          timeLine: '14:00-16:00',
          price: 0,
          description: '散步放松',
        },
      ],
      totalPrice: 80,
      strategy: '轻松半日游',
    });
  }

  async stream(options: AIStreamOptions): Promise<string> {
    const content = await this.chat(options);
    options.onChunk(content);
    return content;
  }
}

// ── 级联 Provider（DashScope → LongCat → Mock） ──

export class CascadingProvider implements AIProvider {
  readonly name = 'cascade';
  private providers: AIProvider[];

  constructor() {
    this.providers = [new DashScopeProvider(), new LongCatProvider(), new MockProvider()];
  }

  async chat(options: AIChatOptions): Promise<string> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        console.log(`[Cascade] 尝试 ${provider.name}...`);
        const result = await provider.chat(options);
        console.log(`[Cascade] ${provider.name} 成功`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[Cascade] ${provider.name} 失败: ${lastError.message}`);

        // 如果是用户取消，直接抛出
        if (lastError.message === 'AbortError') throw lastError;
      }
    }

    throw lastError || new Error('所有 Provider 调用失败');
  }

  async stream(options: AIStreamOptions): Promise<string> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        console.log(`[Cascade] 尝试 ${provider.name} stream...`);
        const result = await provider.stream(options);
        console.log(`[Cascade] ${provider.name} stream 成功`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[Cascade] ${provider.name} stream 失败: ${lastError.message}`);

        if (lastError.message === 'AbortError') throw lastError;
      }
    }

    throw lastError || new Error('所有 Provider stream 调用失败');
  }
}

// ── 当前 Provider 管理 ──

let currentProvider: AIProvider | null = null;

/**
 * 获取当前 AI Provider
 *
 * 优先级：环境变量 VITE_AI_PROVIDER > 已设置的 provider > CascadingProvider（默认）
 */
export function getAIProvider(): AIProvider {
  if (!currentProvider) {
    const providerName =
      (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_AI_PROVIDER : '') || 'cascade';
    switch (providerName) {
      case 'dashscope':
        currentProvider = new DashScopeProvider();
        break;
      case 'longcat':
        currentProvider = new LongCatProvider();
        break;
      case 'mock':
        currentProvider = new MockProvider();
        break;
      case 'cascade':
      default:
        currentProvider = new CascadingProvider();
        break;
    }
  }
  return currentProvider;
}

export function setAIProvider(provider: AIProvider): void {
  currentProvider = provider;
}

export function resetAIProvider(): void {
  currentProvider = null;
}

/**
 * 获取模型健康状态（用于调试）
 */
export function getModelHealthStatus(): Array<{
  model: string;
  provider: string;
  healthy: boolean;
  lastFailure?: number;
}> {
  const status: Array<{ model: string; provider: string; healthy: boolean; lastFailure?: number }> =
    [];

  // DashScope 模型
  for (const model of DASHSCOPE_MODELS) {
    const key = getModelHealthKey('dashscope', model);
    const health = modelHealthMap.get(key);
    status.push({
      model,
      provider: 'dashscope',
      healthy: isModelHealthy('dashscope', model),
      lastFailure: health?.lastFailure,
    });
  }

  // LongCat 模型
  for (const model of LONGCAT_MODELS) {
    const key = getModelHealthKey('longcat', model);
    const health = modelHealthMap.get(key);
    status.push({
      model,
      provider: 'longcat',
      healthy: isModelHealthy('longcat', model),
      lastFailure: health?.lastFailure,
    });
  }

  return status;
}
