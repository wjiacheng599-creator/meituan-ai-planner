/**
 * SSE Client - 前端 SSE 流式连接服务
 *
 * 提供连接到 /api/proxy/dashscope/stream 并解析流式响应的能力
 */

interface SSEOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  onChunk: (chunk: SSEChunk) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}

interface SSEChunk {
  type: 'delta' | 'tool_call' | 'finish' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: string;
  finishReason?: string;
  error?: string;
}

/**
 * 启动 SSE 流式连接
 * 返回 abort 函数用于取消连接
 */
export function startSSEStream(options: SSEOptions): () => void {
  const controller = new AbortController();
  let fullText = '';
  let buffer = '';

  (async () => {
    try {
      const response = await fetch(apiUrl('/api/proxy/dashscope/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          tools: options.tools,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        options.onError(new Error(`SSE connection failed: ${response.status} ${errorText}`));
        return;
      }

      if (!response.body) {
        options.onError(new Error('SSE response body is null'));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);

          if (data === '[DONE]') {
            options.onDone(fullText);
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              options.onError(new Error(parsed.error));
              return;
            }

            // 解析 OpenAI 兼容的流式响应格式
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            // 处理 delta 内容
            const deltaContent = choice.delta?.content;
            if (deltaContent) {
              fullText += deltaContent;
              options.onChunk({
                type: 'delta',
                content: deltaContent,
              });
            }

            // 处理工具调用
            const toolCalls = choice.delta?.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
              for (const tc of toolCalls) {
                options.onChunk({
                  type: 'tool_call',
                  toolName: tc.function?.name,
                  toolArgs: tc.function?.arguments,
                });
              }
            }

            // 处理完成原因
            const finishReason = choice.finish_reason;
            if (finishReason) {
              options.onChunk({
                type: 'finish',
                finishReason,
              });
            }
          } catch (e) {
            // 无法解析的行，跳过
          }
        }
      }

      options.onDone(fullText);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户取消，不报错
        return;
      }
      options.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  // 返回取消函数
  return () => controller.abort();
}

/**
 * 简化的流式调用——返回完整文本
 */
export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    startSSEStream({
      messages,
      onChunk: (chunk) => {
        if (chunk.type === 'delta' && chunk.content) {
          onChunk(chunk.content);
        }
      },
      onDone: (fullText) => resolve(fullText),
      onError: (err) => reject(err),
    });
  });
}
