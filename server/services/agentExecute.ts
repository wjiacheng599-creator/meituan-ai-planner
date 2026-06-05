/**
 * 服务端 Agent 执行引擎
 *
 * 在服务端调用 AI + 工具执行，通过 SSE 流式返回步骤结果。
 * 复用 src/services/tools.ts 中的工具定义和执行器。
 */

import { stripMarkdown } from '../../src/services/ai/utils';
import type { Activity, WeatherInfo } from '../../src/services/ai/types';
import type { AgentStep, AgentResult } from '../../src/services/agent';
import { toolSchemas, executeToolByName, type ToolResult } from '../../src/services/tools';
import {
  buildDependencyGraph,
  topologicalSort,
  type ToolCall,
} from '../../src/services/toolDependencyGraph';

const MAX_AGENT_TURNS = 10;
const AI_TIMEOUT_MS = 60000;

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
}

// ── ID 生成 ──

function makeStepId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 工具依赖推断 ──
// 定义工具之间的前置依赖关系：执行某工具前，必须先完成其依赖工具（同一实体）

const TOOL_DEPENDENCY_MAP: Record<string, string[]> = {
  check_availability: ['search_restaurant'],
  check_queue: ['search_restaurant'],
  make_reservation: ['check_availability'],
  join_queue: ['check_queue'],
  book_activity: [],
  search_restaurant: [],
};

function extractEntityName(args: Record<string, unknown>): string {
  return String(args.name || args.restaurant || args.activity || '').toLowerCase().trim();
}

function inferToolDependencies(
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>
): ToolCall[] {
  const calls: ToolCall[] = toolCalls.map((tc) => {
    const args = JSON.parse(tc.function.arguments || '{}');
    const entity = extractEntityName(args);
    const deps = TOOL_DEPENDENCY_MAP[tc.function.name] || [];
    const dependsOn: string[] = [];

    // 在同一批 tool_calls 中查找匹配的前置依赖
    for (const depName of deps) {
      const depCall = toolCalls.find((other) => {
        if (other.id === tc.id) return false;
        if (other.function.name !== depName) return false;
        const otherArgs = JSON.parse(other.function.arguments || '{}');
        const otherEntity = extractEntityName(otherArgs);
        return entity && otherEntity && (entity.includes(otherEntity) || otherEntity.includes(entity));
      });
      if (depCall) {
        dependsOn.push(depCall.id);
      }
    }

    return {
      id: tc.id,
      tool: tc.function.name as ToolCall['tool'],
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      input: args,
    };
  });

  return calls;
}

// ── AI 配置（级联） ──

function getAIConfigs(): Array<{ baseUrl: string; apiKey: string; model: string; name: string }> {
  const dashscopeKey = process.env.DASHSCOPE_API_KEY || '';
  const longcatKey = process.env.LONGCAT_API_KEY || '';

  const configs: Array<{ baseUrl: string; apiKey: string; model: string; name: string }> = [];

  if (dashscopeKey) {
    configs.push({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: dashscopeKey,
      model: 'qwen-plus',
      name: 'DashScope',
    });
  }

  if (longcatKey) {
    configs.push({
      baseUrl: 'https://api.longcat.chat/openai/v1/chat/completions',
      apiKey: longcatKey,
      model: 'LongCat-2.0-Preview',
      name: 'LongCat',
    });
  }

  return configs;
}

// ── AI + 工具调用循环（级联降级） ──

async function callAIWithTools(
  messages: ChatMessage[],
  tools: typeof toolSchemas,
  onStep: (step: AgentStep) => void,
  turns: number = 0
): Promise<{ reply: ChatMessage; steps: AgentStep[] }> {
  const allSteps: AgentStep[] = [];
  const configs = getAIConfigs();

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
        const errText = await response.text().catch(() => '');
        const isQuotaError =
          response.status === 403 && (errText.includes('exhausted') || errText.includes('额度'));
        console.warn(
          `[Agent] ${config.name} (${config.model}) 失败: ${response.status}${isQuotaError ? ' (额度耗尽)' : ''}`
        );
        lastError = new Error(
          `${config.name} API error: ${response.status} - ${errText.slice(0, 200)}`
        );
        if (isQuotaError) continue; // 额度耗尽，尝试下一个 provider
        throw lastError;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message;

      if (!reply) {
        throw new Error(`${config.name} returned empty response`);
      }

      // AI 要求调用工具
      if (reply.tool_calls && reply.tool_calls.length > 0) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: reply.content || '',
          tool_calls: reply.tool_calls,
        };
        messages.push(assistantMsg);

        // ── DAG 编排：按依赖关系分层执行工具 ──
        const toolCallsWithDeps = inferToolDependencies(reply.tool_calls);
        const graph = buildDependencyGraph(toolCallsWithDeps);
        const levels = topologicalSort(graph);

        const toolResults: Array<{ tc: typeof reply.tool_calls[number]; result: ToolResult }> = [];

        for (const { calls: levelCallIds } of levels) {
          // 同一层级内的工具可并行执行
          const levelResults = await Promise.all(
            levelCallIds.map(async (callId) => {
              const tc = reply.tool_calls.find((t) => t.id === callId);
              if (!tc) return null;

              const args = JSON.parse(tc.function.arguments || '{}');
              const toolStep: AgentStep = {
                id: makeStepId(),
                type: 'tool_call',
                content: `调用 ${tc.function.name}`,
                toolName: tc.function.name,
                toolArgs: args,
                status: 'running',
                startedAt: Date.now(),
              };
              allSteps.push(toolStep);
              onStep(toolStep);

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
                ...toolStep,
                type: 'tool_result',
                content: result.message,
                toolResult: result,
                status: result.success ? 'success' : 'failed',
                finishedAt: Date.now(),
              };

              const stepIdx = allSteps.findIndex((s) => s.id === toolStep.id);
              if (stepIdx >= 0) allSteps[stepIdx] = resultStep;
              onStep(resultStep);

              return { tc, result };
            })
          );

          for (const r of levelResults) {
            if (r) toolResults.push(r);
          }
        }

        for (const { tc, result } of toolResults) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
            name: tc.function.name,
          });
        }

        if (turns < MAX_AGENT_TURNS) {
          const nextResult = await callAIWithTools(messages, tools, onStep, turns + 1);
          allSteps.push(...nextResult.steps);
          return { reply: nextResult.reply, steps: allSteps };
        }

        return {
          reply: { role: 'assistant', content: '已达到最大 Agent 轮次限制。' },
          steps: allSteps,
        };
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

// ── 主执行函数 ──

export interface ServerAgentParams {
  activities: Activity[];
  planTitle: string;
  city: string;
  peopleCount: number;
  weather?: WeatherInfo;
}

export async function executeAgentOnServer(
  params: ServerAgentParams,
  onStep: (step: AgentStep) => void,
  signal?: AbortSignal
): Promise<AgentResult> {
  if (signal?.aborted) {
    return {
      answer: '执行已取消',
      steps: [],
      totalToolCalls: 0,
      successCount: 0,
      failCount: 0,
      isCancelled: true,
    };
  }

  const { activities, planTitle, city, peopleCount, weather } = params;

  const activityList = activities
    .map(
      (a, i) =>
        `${i + 1}. [${a.timeLine}] ${a.title} (${a.type === 'food' ? '美食' : a.type === 'travel' ? '交通' : '活动'}) ¥${a.price} - ${a.description}`
    )
    .join('\n');

  const weatherCtx = weather
    ? `\n当前天气：${weather.condition} ${weather.temp}°C，${weather.advice}`
    : '';

  const systemPrompt = `你是美团本地生活 AI Agent，负责为用户执行行程预订任务。

你有权使用 Tool Catalog 中定义的工具。根据需要使用它们来帮助用户执行旅行计划。

你需要按照以下策略逐步完成任务：
1. 先计算整体路线（calculate_route）
2. 对每个美食类活动：搜索商家 → 检查可用性 → 预订座位
3. 对每个非美食活动：直接预约
4. 如有排队需求，查询排队情况并取号

当前行程信息：
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

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: '请帮我执行这个行程的所有预订和预约。从路线规划开始，然后依次处理每个活动。',
    },
  ];

  try {
    const result = await callAIWithTools(messages, toolSchemas, onStep);

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
    onStep(answerStep);

    return {
      answer: answerStep.content,
      steps,
      totalToolCalls: steps.filter((s) => s.type === 'tool_result').length,
      successCount: steps.filter((s) => s.type === 'tool_result' && s.status === 'success').length,
      failCount: steps.filter((s) => s.type === 'tool_result' && s.status === 'failed').length,
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
