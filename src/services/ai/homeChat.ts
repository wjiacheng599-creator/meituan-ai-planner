/**
 * homeChat.ts - Home 页专用 AI 对话服务
 *
 * 用于处理 Home 页的通用对话（chat 意图），
 * 替代之前的硬编码回复，提供个性化、有温度的 AI 对话体验。
 */
import { sanitizeUserInput, callDashScope } from './core';
import { withServerFallback } from '../../utils/withServerFallback';
import type { PersonProfile } from '../../types';
import type { Plan } from './types';
import { getChatModePrompt, getPlanModePrompt, isChatMode, isPlanMode } from './xiaomeiPersona';
import { stripMarkdown } from './utils';

export interface HomeChatResult {
  text: string;
  suggestedPrompts?: string[];
  intent?: 'plan' | 'restaurant' | 'weather' | 'general';
}

/**
 * 在 Home 页进行 AI 对话
 * 根据用户画像、城市、时间等上下文生成个性化回复
 */
export async function chatInHomeLocally(
  message: string,
  context: {
    city: string;
    profiles: PersonProfile[];
    recentPlans: Plan[];
    currentHour: number;
  }
): Promise<HomeChatResult> {
  message = sanitizeUserInput(message, 300);

  const profileSummary =
    context.profiles.length > 0
      ? context.profiles
          .map((p) => {
            const parts = [p.name, p.relation, p.ageGroup];
            if (p.travelPreferences?.length)
              parts.push(`偏好:${p.travelPreferences.slice(0, 2).join('、')}`);
            return parts.join(',');
          })
          .join('；')
      : '单人出行';

  const recentContext =
    context.recentPlans.length > 0
      ? `\n用户最近的行程：${context.recentPlans
          .slice(0, 2)
          .map((p) => p.title)
          .join('、')}`
      : '';

  // ─── 核心改动：根据消息内容判断闲聊/规划模式 ──────────
  const chatMode = isChatMode(message);
  const planMode = !chatMode && isPlanMode(message);

  // 根据模式选择不同的 system prompt
  let systemPrompt: string;

  if (chatMode) {
    // 闲聊模式：陪伴优先，不推消费
    systemPrompt = getChatModePrompt({
      city: context.city,
      userName: context.profiles[0]?.name,
    });
  } else {
    // 规划模式：可以推荐本地生活服务
    systemPrompt = getPlanModePrompt({
      city: context.city,
      userName: context.profiles[0]?.name,
      hasChildren: context.profiles.some((p) => p.ageGroup === 'child'),
      hasElderly: context.profiles.some((p) => p.ageGroup === 'elderly'),
      companions: context.profiles
        .map((p) => p.relation)
        .filter(Boolean)
        .join('、'),
    });
  }

  // 追加当前上下文到 prompt（模式 prompt 已包含基础人设）
  systemPrompt += `

【当前对话上下文】
- 城市：${context.city}
- 时间：${context.currentHour < 12 ? '上午' : context.currentHour < 18 ? '下午' : '晚上'}（${context.currentHour}点）
- 同行人员：${profileSummary}${recentContext}

根据用户的消息，给出有温度的回复。`;

  try {
    const raw = await callDashScope(systemPrompt, message, true);

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    if (parsed) {
      const text = parsed.text || parsed.content || parsed.reply || '';
      if (text && typeof text === 'string') {
        const suggestedPrompts = Array.isArray(parsed.suggestedPrompts || parsed.suggestions)
          ? ((parsed.suggestedPrompts || parsed.suggestions) as string[]).slice(0, 2)
          : [];
        return {
          text: stripMarkdown(text),
          suggestedPrompts,
          intent:
            (parsed.intent as HomeChatResult['intent']) ||
            ((parsed as Record<string, unknown>).action === 'plan'
              ? 'plan'
              : chatMode
                ? 'general'
                : 'plan'),
        };
      }
    }

    // 解析失败，清洗原始文本（去掉 markdown/json 格式符号）
    return {
      text:
        stripMarkdown(
          raw
            .replace(/[{}\[\]"']/g, '')
            .replace(/reply|content|status|text|action/g, '')
            .trim()
            .slice(0, 300)
        ) || '有什么我能帮你的吗？',
      suggestedPrompts: [],
      intent: chatMode ? 'general' : 'plan',
    };
  } catch (error) {
    console.error('[homeChat] AI 调用失败:', error);
    return {
      text: '有什么我能帮你的吗？我可以帮你找餐厅、查天气，或者规划出行路线。',
      suggestedPrompts: ['帮我找附近餐厅', '规划出行路线'],
      intent: 'general',
    };
  }
}

export async function chatInHome(
  message: string,
  context: {
    city: string;
    profiles: PersonProfile[];
    recentPlans: Plan[];
    currentHour: number;
  }
): Promise<HomeChatResult> {
  const result = await withServerFallback(
    async () => {
      const { chatInHomeViaServer } = await import('../serverApi');
      return chatInHomeViaServer({
        message,
        city: context.city,
        profiles: context.profiles,
        recentPlans: context.recentPlans,
        currentHour: context.currentHour,
      });
    },
    () => chatInHomeLocally(message, context),
    'home chat'
  );

  // 确保最终返回的文本经过清理
  return {
    ...result,
    text: stripMarkdown(result.text),
  };
}
