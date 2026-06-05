import { getAIProvider } from '../provider';
import type { ToolDefinition } from './registry';

export interface LLMIntentResult {
  shouldUseTool: boolean;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  confidence: number;
  fallbackReason?: string;
}

export async function recognizeIntentWithLLM(
  userMessage: string,
  tools: ToolDefinition[],
  context: {
    city?: string;
    recentMessages?: string[];
  } = {}
): Promise<LLMIntentResult> {
  const systemPrompt = `你是一个意图识别专家，根据用户的消息判断应该使用哪个工具。

可用工具：
${tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

任务说明：
1. 判断用户是否需要使用工具，还是只是闲聊
2. 如果需要工具，选择最匹配的一个工具
3. 从用户消息中提取工具需要的参数
4. 特别注意多商品、多规格的复杂需求

复杂需求识别规则：
- "3杯奶茶，一杯去冰一杯少糖一杯正常" → search_delivery，keywords="奶茶 多规格"
- "要2个汉堡，一个加辣一个不加" → search_delivery，keywords="汉堡 多规格"
- "大份改小份" → search_delivery，keywords="修改规格"
- "不要辣的要清淡的" → search_restaurant，keywords="清淡 不要辣"
- "去冰改成少冰" → search_delivery，keywords="修改冰量"

返回 JSON 格式：
{
  "shouldUseTool": true/false,
  "toolName": "工具名称或null",
  "toolArgs": {参数键值对},
  "confidence": 0-1的置信度分数,
  "fallbackReason": "如果不使用工具，给出原因",
  "hasMultiItems": true/false,  // 是否多商品需求
  "hasSpecificationChange": true/false,  // 是否规格修改
  "exclusions": ["排除项1", "排除项2"]  // 排除项列表
}

注意：
- 如果用户说"我想喝奶茶"、"点杯咖啡"、"叫个汉堡"、"来点甜品"，这类应该调用 search_delivery 工具
- 如果用户说"找家餐厅"、"推荐好吃的"，这类应该调用 search_restaurant 工具
- 如果用户说"明天天气怎么样"，调用 search_weather 工具
- 如果只是闲聊（如"你好"、"谢谢"），shouldUseTool 设为 false
- 如果有多商品需求（如"3杯奶茶..."），务必在 toolArgs 中保留完整的用户原始输入作为 keywords
`;

  const provider = getAIProvider();

  try {
    const result = await provider.chat({
      systemPrompt,
      userPrompt: userMessage,
      jsonMode: true,
      temperature: 0.1, // 低温度以保持稳定
    });

    const parsed = JSON.parse(result);
    return {
      shouldUseTool: parsed.shouldUseTool ?? false,
      toolName: parsed.toolName,
      toolArgs: parsed.toolArgs ?? {},
      confidence: parsed.confidence ?? 0.5,
      fallbackReason: parsed.fallbackReason,
    };
  } catch (error) {
    console.warn('[LLM Intent] LLM识别失败，回退到关键词模式', error);
    return {
      shouldUseTool: false,
      confidence: 0,
      fallbackReason: 'LLM识别失败',
    };
  }
}
