import type { Activity, WeatherInfo } from './ai';
import { getUserCity, stripMarkdown } from './ai';
import { executePlanViaServer } from './serverApi';
import { toolSchemas, executeToolByName, type ToolResult } from './tools';
import type { ToolStatus } from './tools';
import { readRuntimeEnv } from './runtimeEnv';
import { retrieveKnowledgeContext } from './knowledge';
import { LRUCache } from '../utils/lruCache';
import { apiUrl } from './apiBase';

// [PERF-OPT] RAG result cache - cache knowledge retrieval results
const ragCache = new LRUCache<string>(200);

// [PERF-OPT] Token budget for agent
const AGENT_TOKEN_BUDGET = 30000;

// Agent 执行模式配置
const DEMO_MODE_FAST = readRuntimeEnv('VITE_DEMO_MODE_FAST') !== 'false';
const USE_REAL_AGENT = readRuntimeEnv('VITE_USE_REAL_AGENT') === 'true';

// [PERF-OPT] Estimate tokens (Chinese text ~2 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

// [PERF-OPT] Enforce token budget by truncating old messages
function enforceTokenBudget(messages: ChatMessage[]): ChatMessage[] {
  // Always keep system prompt (first message)
  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  const otherMessages = systemMessage ? messages.slice(1) : messages;

  // Calculate total tokens
  const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

  if (totalTokens <= AGENT_TOKEN_BUDGET) {
    return messages;
  }

  console.warn(`[PERF-OPT] Token budget exceeded: ~${totalTokens} tokens, truncating...`);

  // Keep system prompt and most recent messages
  let budgetLeft = AGENT_TOKEN_BUDGET;
  const keptMessages: ChatMessage[] = [];

  if (systemMessage) {
    budgetLeft -= estimateTokens(systemMessage.content);
    keptMessages.push(systemMessage);
  }

  // Add messages from most recent
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(otherMessages[i].content);
    if (msgTokens <= budgetLeft) {
      keptMessages.unshift(otherMessages[i]);
      budgetLeft -= msgTokens;
    } else {
      console.warn(`[PERF-OPT] Dropped old message due to token budget`);
      break;
    }
  }

  console.log(`[PERF-OPT] Truncated from ${messages.length} to ${keptMessages.length} messages`);
  return keptMessages;
}

// ── AI Provider 配置 ──
// 主力：通义千问（DashScope）；备用：美团 LongCat
const DASHSCOPE_BASE_URL_LOCAL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_API_KEY = readRuntimeEnv('VITE_DASHSCOPE_API_KEY') || '';

const LONGCAT_BASE_URL = 'https://api.longcat.chat/openai/v1/chat/completions';
const LONGCAT_API_KEY =
  readRuntimeEnv('VITE_LONGCAT_API_KEY') || readRuntimeEnv('LONGCAT_API_KEY') || '';

const MAX_AGENT_TURNS = 10;
const AI_TIMEOUT_MS = 60000;
const ENABLE_RAG = readRuntimeEnv('VITE_ENABLE_RAG') !== 'false';

// 获取当前 provider 的配置（DashScope 为主，LongCat 备用）
function getAIConfig(): { baseUrl: string; apiKey: string; model: string; authHeader: string } {
  if (DASHSCOPE_API_KEY) {
    return {
      baseUrl: DASHSCOPE_BASE_URL_LOCAL,
      apiKey: DASHSCOPE_API_KEY,
      model: 'qwen-plus',
      authHeader: 'Authorization',
    };
  }
  // 备用：LongCat
  return {
    baseUrl: LONGCAT_BASE_URL,
    apiKey: LONGCAT_API_KEY,
    model: 'LongCat-2.0-Preview',
    authHeader: 'Authorization',
  };
}

export interface AgentStep {
  id: string;
  type: 'think' | 'tool_call' | 'tool_result' | 'answer';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
  status: ToolStatus;
  startedAt: number;
  finishedAt?: number;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  totalToolCalls: number;
  successCount: number;
  failCount: number;
  isCancelled?: boolean;
}

export interface AgentExecuteOptions {
  signal?: AbortSignal;
  onCancelled?: () => void;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
}

enum AgentErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTH_ERROR = 'AUTH_ERROR',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  UNKNOWN = 'UNKNOWN',
}

interface FallbackStrategy {
  shouldFallback: boolean;
  fallbackType:
    | 'server_to_local'
    | 'local_to_server'
    | 'retry_with_backoff'
    | 'delay_and_retry'
    | 'none';
  reason: string;
  partialResult?: AgentResult;
  retryDelayMs?: number;
}

function classifyAgentError(error: unknown, result?: AgentResult): AgentErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('aborterror')) {
      console.error('[Agent Error] TIMEOUT:', error.message);
      return AgentErrorType.TIMEOUT;
    }
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('failed to fetch')
    ) {
      console.error('[Agent Error] NETWORK_ERROR:', error.message);
      return AgentErrorType.NETWORK_ERROR;
    }
    if (
      message.includes('401') ||
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {
      console.error('[Agent Error] AUTH_ERROR:', error.message);
      return AgentErrorType.AUTH_ERROR;
    }
    if (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      console.error('[Agent Error] RATE_LIMITED:', error.message);
      return AgentErrorType.RATE_LIMITED;
    }
    if (message.includes('503') || message.includes('service unavailable')) {
      console.error('[Agent Error] SERVICE_UNAVAILABLE:', error.message);
      return AgentErrorType.SERVICE_UNAVAILABLE;
    }
    if (message.includes('api') || message.includes('500') || message.includes('internal server')) {
      console.error('[Agent Error] API_ERROR:', error.message);
      return AgentErrorType.API_ERROR;
    }
  }

  if (result && result.totalToolCalls > 0) {
    const failRate = result.failCount / result.totalToolCalls;
    if (failRate > 0.3) {
      console.warn('[Agent Error] PARTIAL_FAILURE - failRate:', (failRate * 100).toFixed(0) + '%');
      return AgentErrorType.PARTIAL_FAILURE;
    }
  }

  if (error) {
    console.warn('[Agent Error] UNKNOWN:', error);
  }
  return AgentErrorType.UNKNOWN;
}

function determineFallbackStrategy(
  error: unknown,
  result?: AgentResult,
  isServerExecution: boolean = true
): FallbackStrategy {
  const errorType = classifyAgentError(error, result);

  if (errorType === AgentErrorType.NETWORK_ERROR || errorType === AgentErrorType.TIMEOUT) {
    return {
      shouldFallback: true,
      fallbackType: isServerExecution ? 'server_to_local' : 'local_to_server',
      reason: `网络问题：${error instanceof Error ? error.message : '连接失败'}`,
    };
  }

  if (errorType === AgentErrorType.API_ERROR) {
    return {
      shouldFallback: true,
      fallbackType: 'retry_with_backoff',
      reason: `API错误，可能需要重试`,
    };
  }

  if (errorType === AgentErrorType.RATE_LIMITED) {
    return {
      shouldFallback: true,
      fallbackType: 'delay_and_retry',
      reason: `请求被限流，延迟后重试`,
      retryDelayMs: 5000,
    };
  }

  if (errorType === AgentErrorType.SERVICE_UNAVAILABLE) {
    return {
      shouldFallback: true,
      fallbackType: isServerExecution ? 'server_to_local' : 'local_to_server',
      reason: `服务暂时不可用，切换执行方式`,
    };
  }

  if (errorType === AgentErrorType.AUTH_ERROR) {
    return {
      shouldFallback: true,
      fallbackType: isServerExecution ? 'server_to_local' : 'local_to_server',
      reason: `认证失败，尝试本地执行`,
    };
  }

  if (errorType === AgentErrorType.PARTIAL_FAILURE && result) {
    const failRate = result.failCount / result.totalToolCalls;
    if (failRate > 0.5) {
      return {
        shouldFallback: true,
        fallbackType: isServerExecution ? 'server_to_local' : 'local_to_server',
        reason: `失败率过高 (${(failRate * 100).toFixed(0)}%)，切换执行方式`,
        partialResult: result,
      };
    }
    return {
      shouldFallback: false,
      fallbackType: 'none',
      reason: `失败率可接受，返回当前结果`,
      partialResult: result,
    };
  }

  if (result && result.totalToolCalls === 0 && result.answer.startsWith('Agent 执行出错')) {
    return {
      shouldFallback: true,
      fallbackType: isServerExecution ? 'server_to_local' : 'local_to_server',
      reason: `Agent执行完全失败，尝试替代方案`,
    };
  }

  return {
    shouldFallback: false,
    fallbackType: 'none',
    reason: '无需fallback',
  };
}

function mergeAgentResults(result1: AgentResult, result2: AgentResult): AgentResult {
  const stepMap = new Map<string, AgentStep>();

  for (const step of result1.steps) {
    stepMap.set(step.id, step);
  }

  for (const step of result2.steps) {
    if (!stepMap.has(step.id)) {
      stepMap.set(step.id, step);
    }
  }

  const mergedSteps = Array.from(stepMap.values());
  const totalToolCalls = mergedSteps.filter((s) => s.type === 'tool_result').length;
  const successCount = mergedSteps.filter(
    (s) => s.type === 'tool_result' && s.status === 'success'
  ).length;
  const failCount = mergedSteps.filter(
    (s) => s.type === 'tool_result' && s.status === 'failed'
  ).length;

  return {
    answer: failCount === 0 ? '所有预订任务已完成' : `${successCount} 项成功，${failCount} 项失败`,
    steps: mergedSteps,
    totalToolCalls,
    successCount,
    failCount,
  };
}

function makeStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function callDashScopeWithTools(
  messages: ChatMessage[],
  tools: typeof toolSchemas,
  onStep?: (step: AgentStep) => void,
  turns: number = 0
): Promise<{ reply: ChatMessage; steps: AgentStep[] }> {
  enforceTokenBudget(messages);
  const allSteps: AgentStep[] = [];

  // 级联配置：DashScope → LongCat
  const configs = [
    ...(DASHSCOPE_API_KEY
      ? [
          {
            baseUrl: DASHSCOPE_BASE_URL_LOCAL,
            apiKey: DASHSCOPE_API_KEY,
            model: 'qwen-plus',
            name: 'DashScope',
          },
        ]
      : []),
    {
      baseUrl: LONGCAT_BASE_URL,
      apiKey: LONGCAT_API_KEY,
      model: 'LongCat-2.0-Preview',
      name: 'LongCat',
    },
  ];

  let lastError: Error | null = null;

  for (const config of configs) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      };

      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          tools,
          temperature: 0.3,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errText = await response.text();
        const isQuotaError =
          response.status === 403 && (errText.includes('exhausted') || errText.includes('额度'));
        console.warn(
          `[Agent] ${config.name} (${config.model}) 失败: ${response.status}${isQuotaError ? ' (额度耗尽)' : ''}`
        );
        lastError = new Error(`${config.name} API error: ${response.status} - ${errText}`);
        if (isQuotaError) continue; // 额度耗尽，尝试下一个 provider
        throw lastError;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message;

      if (!reply) {
        throw new Error(`${config.name} returned empty response`);
      }

      if (reply.tool_calls && reply.tool_calls.length > 0) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: reply.content || '',
          tool_calls: reply.tool_calls,
        };
        if (reply.reasoning_content) {
          assistantMsg.reasoning_content = reply.reasoning_content;
        }
        messages.push(assistantMsg);

        const toolPromises = reply.tool_calls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments || '{}');
          const thinkStep: AgentStep = {
            id: makeStepId(),
            type: 'tool_call',
            content: `调用 ${tc.function.name}`,
            toolName: tc.function.name,
            toolArgs: args,
            status: 'running',
            startedAt: Date.now(),
          };
          allSteps.push(thinkStep);
          onStep?.(thinkStep);

          let result: ToolResult;
          try {
            result = await executeToolByName(tc.function.name, args);
          } catch (err) {
            result = {
              success: false,
              message: `执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
            };
          }

          const resultStep: AgentStep = {
            ...thinkStep,
            type: 'tool_result',
            content: result.message,
            toolResult: result,
            status: result.success ? 'success' : 'failed',
            finishedAt: Date.now(),
          };

          const stepIdx = allSteps.findIndex((s) => s.id === thinkStep.id);
          if (stepIdx >= 0) allSteps[stepIdx] = resultStep;
          onStep?.(resultStep);

          return { tc, result };
        });

        const toolResults = await Promise.all(toolPromises);

        for (const { tc, result } of toolResults) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
            name: tc.function.name,
          });
        }

        if (turns >= MAX_AGENT_TURNS) {
          return {
            reply: { role: 'assistant', content: '已达到最大 Agent 轮次限制，停止继续调用工具。' },
            steps: allSteps,
          };
        }

        const nextResult = await callDashScopeWithTools(messages, tools, onStep, turns + 1);
        allSteps.push(...nextResult.steps);
        return { reply: nextResult.reply, steps: allSteps };
      }

      return { reply, steps: allSteps };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === 'AbortError') throw lastError;
      // 继续尝试下一个 provider
    }
  }

  throw lastError || new Error('所有 AI Provider 调用失败');
}

export async function agentExecuteLocally(
  params: {
    activities: Activity[];
    planTitle: string;
    city: string;
    peopleCount: number;
    weather?: WeatherInfo;
    onStep?: (step: AgentStep) => void;
  },
  options?: AgentExecuteOptions
): Promise<AgentResult> {
  if (options?.signal?.aborted) {
    return {
      answer: '执行已取消',
      steps: [],
      totalToolCalls: 0,
      successCount: 0,
      failCount: 0,
      isCancelled: true,
    };
  }

  const { activities, planTitle, city, peopleCount, weather, onStep } = params;

  const activityList = activities
    .map(
      (a, i) =>
        `${i + 1}. [${a.timeLine}] ${a.title} (${a.type === 'food' ? '美食' : a.type === 'travel' ? '交通' : '活动'}) ¥${a.price} - ${a.description}`
    )
    .join('\n');

  const weatherCtx = weather
    ? `\n当前天气：${weather.condition} ${weather.temp}°C，${weather.advice}`
    : '';

  let knowledgeCtx = '';
  if (ENABLE_RAG) {
    try {
      // [PERF-OPT] Check RAG cache first
      const cacheKey = `${planTitle}|${city}|${activities.map((a) => a.id || a.title).join(',')}`;
      if (ragCache.has(cacheKey)) {
        knowledgeCtx = ragCache.get(cacheKey)!;
      } else {
        // [PERF-OPT] Cache miss - retrieve and cache
        knowledgeCtx = await retrieveKnowledgeContext(planTitle, city, activityList);
        if (knowledgeCtx) {
          ragCache.set(cacheKey, knowledgeCtx);
        }
      }
    } catch (error) {
      console.warn('[Agent] RAG knowledge retrieval failed:', error);
    }
  }

  const systemPrompt = `你是美团本地生活 AI Agent，负责为用户执行行程预订任务。

你有权使用 Tool Catalog 中定义的工具。根据需要使用它们来帮助用户执行旅行计划。

你需要按照以下策略逐步完成任务：
1. 先计算整体路线（calculate_route）
2. 对每个美食类活动：搜索商家 → 检查可用性 → 预订座位
3. 对每个非美食活动：直接预约
4. 如有排队需求，查询排队情况并取号

${knowledgeCtx ? `【知识库参考】\n${knowledgeCtx}\n\n` : ''}当前行程信息：
- 行程：${planTitle}
- 城市：${city}
- 人数：${peopleCount}人
${weatherCtx}
- 活动列表：
${activityList}

注意事项：
- 电话统一使用 "138****8888"
- 按活动顺序依次处理
- 如果某个工具调用失败，继续处理下一个
- 每个工具调用完成后简要说明结果

配送能力提醒：
- 你可以使用 order_delivery 工具为用户安排蛋糕、鲜花、礼物等送到指定餐厅或地点
- 在生日、纪念日、家庭聚会、亲子出游场景中，主动建议"要不要订个蛋糕/鲜花送到餐厅？"
- 用户确认后一键下单，送达时间建议设为活动结束前 30 分钟`;

  const userPrompt = `请帮我执行这个行程的所有预订和预约。从路线规划开始，然后依次处理每个活动。`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // [PERF-OPT] Enforce token budget before sending to AI
  const enforcedMessages = enforceTokenBudget(messages);

  try {
    const result = await callDashScopeWithTools(enforcedMessages, toolSchemas, onStep);

    if (!result || !result.steps) {
      throw new Error('Agent returned invalid response');
    }

    const { reply, steps } = result;

    const answerStep: AgentStep = {
      id: makeStepId(),
      type: 'answer',
      content: stripMarkdown(reply.content || '所有预订任务已完成'),
      status: 'success',
      startedAt: Date.now(),
      finishedAt: Date.now(),
    };
    steps.push(answerStep);
    onStep?.(answerStep);

    const successCount = steps.filter(
      (s) => s.type === 'tool_result' && s.status === 'success'
    ).length;
    const failCount = steps.filter((s) => s.type === 'tool_result' && s.status === 'failed').length;

    return {
      answer: answerStep.content,
      steps,
      totalToolCalls: steps.filter((s) => s.type === 'tool_result').length,
      successCount,
      failCount,
    };
  } catch (err) {
    const errorStep: AgentStep = {
      id: makeStepId(),
      type: 'answer',
      content: `Agent 执行出错: ${err instanceof Error ? err.message : '未知错误'}`,
      status: 'failed',
      startedAt: Date.now(),
      finishedAt: Date.now(),
    };
    return {
      answer: errorStep.content,
      steps: [errorStep],
      totalToolCalls: 0,
      successCount: 0,
      failCount: 0,
    };
  }
}

export async function agentExecute(
  params: {
    activities: Activity[];
    planTitle: string;
    city: string;
    peopleCount: number;
    weather?: WeatherInfo;
    onStep?: (step: AgentStep) => void;
    planId?: string;
  },
  options?: AgentExecuteOptions
): Promise<AgentResult> {
  if (options?.signal?.aborted) {
    return {
      answer: '执行已取消',
      steps: [],
      totalToolCalls: 0,
      successCount: 0,
      failCount: 0,
      isCancelled: true,
    };
  }

  // 优先调用服务端 Agent（有 API Key，真实 AI 执行）
  try {
    const result = await executeAgentViaServer(params, options);
    return result;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        answer: '执行已取消',
        steps: [],
        totalToolCalls: 0,
        successCount: 0,
        failCount: 0,
        isCancelled: true,
      };
    }
    console.warn('[Agent] Server execution failed, falling back to local:', err);
  }

  // 降级：本地快速执行（模拟模式）
  if (DEMO_MODE_FAST) {
    console.log('[Agent] Using: Fast Demo Mode (local fallback)');
    return fastAgentExecute(params, options);
  }

  return agentExecuteLocally(params, options);
}

// ── 服务端 Agent 执行（SSE 流式） ──

async function executeAgentViaServer(
  params: {
    activities: Activity[];
    planTitle: string;
    city: string;
    peopleCount: number;
    weather?: WeatherInfo;
    onStep?: (step: AgentStep) => void;
  },
  options?: AgentExecuteOptions
): Promise<AgentResult> {
  const response = await fetch(apiUrl('/api/agent/execute'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activities: params.activities,
      planTitle: params.planTitle,
      city: params.city,
      peopleCount: params.peopleCount,
      weather: params.weather,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Server agent API error: ${response.status}`);
  }

  // SSE 流式读取
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let finalResult: AgentResult | null = null;
  let sseError: Error | null = null;

  const parseSSELine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'step' && data.step) {
        params.onStep?.(data.step);
      } else if (data.type === 'done' && data.result) {
        finalResult = data.result;
      } else if (data.type === 'error') {
        sseError = new Error(data.error);
      }
    } catch (parseErr) {
      console.warn('[agent] Skipping malformed SSE line:', line.substring(0, 100));
    }
  };

  try {
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        parseSSELine(line);
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        parseSSELine(line);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (sseError) throw sseError;
  if (!finalResult) throw new Error('No result received from server');
  return finalResult;
}

// 快速执行模式：跳过AI思考，直接模拟所有工具调用成功
async function fastAgentExecute(
  params: {
    activities: Activity[];
    planTitle: string;
    city: string;
    peopleCount: number;
    weather?: WeatherInfo;
    onStep?: (step: AgentStep) => void;
  },
  options?: AgentExecuteOptions
): Promise<AgentResult> {
  const { activities, onStep } = params;
  const steps: AgentStep[] = [];

  for (const activity of activities) {
    if (options?.signal?.aborted) break;
    const toolName = activity.type === 'food' ? 'make_reservation' : 'book_activity';
    const toolArgs: Record<string, unknown> =
      activity.type === 'food'
        ? {
            name: activity.title,
            time: activity.timeLine,
            people: params.peopleCount,
            contact: '138****8888',
          }
        : { name: activity.title, time: activity.timeLine, people: params.peopleCount };

    const toolStep: AgentStep = {
      id: makeStepId(),
      type: 'tool_call',
      toolName,
      toolArgs,
      content: `调用 ${toolName}: ${activity.title}`,
      status: 'running',
      startedAt: Date.now(),
    };
    steps.push(toolStep);
    onStep?.(toolStep);

    const result = await executeToolByName(toolName, toolArgs);

    const resultStep: AgentStep = {
      id: makeStepId(),
      type: 'tool_result',
      toolName,
      toolArgs,
      toolResult: result,
      content: result.message,
      status: result.success ? 'success' : 'failed',
      startedAt: toolStep.startedAt,
      finishedAt: Date.now(),
    };
    steps.push(resultStep);
    onStep?.(resultStep);
  }

  // 添加完成步骤
  const answerStep: AgentStep = {
    id: makeStepId(),
    type: 'answer',
    content: '所有预订任务已成功完成！',
    status: 'success',
    startedAt: Date.now(),
    finishedAt: Date.now(),
  };
  steps.push(answerStep);
  onStep?.(answerStep);

  return {
    answer: answerStep.content,
    steps,
    totalToolCalls: activities.length,
    successCount: steps.filter((s) => s.type === 'tool_result' && s.status === 'success').length,
    failCount: steps.filter((s) => s.type === 'tool_result' && s.status === 'failed').length,
  };
}
