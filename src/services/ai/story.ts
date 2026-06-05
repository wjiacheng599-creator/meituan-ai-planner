import { generateStoryViaServer } from '../serverApi';
import { withServerFallback } from '../../utils/withServerFallback';
import { AIStoryContent } from './types';
import { sanitizeUserInput, callDashScope } from './core';

export async function generateAIStoryLocally(params: {
  planTitle: string;
  activities: string[];
  moodText?: string;
  checkInCount: number;
}): Promise<AIStoryContent> {
  // Sanitize user inputs to prevent prompt injection
  const sanitizedParams = {
    planTitle: sanitizeUserInput(params.planTitle),
    activities: params.activities.map((a) => sanitizeUserInput(a)),
    moodText: params.moodText ? sanitizeUserInput(params.moodText) : undefined,
    checkInCount: params.checkInCount,
  };

  const systemPrompt = `你是美团 AI 旅行回忆录生成器。根据出行信息生成温暖、有画面感的旅行回忆录。
返回 JSON：
{"title":"回忆录标题","paragraphs":["段落1","段落2","段落3"],"highlights":[{"icon":"footprints","label":"足迹","value":"4 个地点"},{"icon":"heart","label":"快乐指数","value":"98%"},{"icon":"star","label":"最佳时刻","value":"描述"},{"icon":"camera","label":"精选瞬间","value":"描述"}]}`;

  const userPrompt = `出行主题：${sanitizedParams.planTitle}
打卡地点：${sanitizedParams.activities.join('、')}
打卡数量：${sanitizedParams.checkInCount} 个地点
${sanitizedParams.moodText ? `用户心情：${sanitizedParams.moodText}` : ''}`;

  try {
    const rawText = await callDashScope(systemPrompt, userPrompt, true);
    return JSON.parse(rawText) as AIStoryContent;
  } catch {
    return {
      title: '一场难忘的城市漫步',
      paragraphs: [
        `在这次「${params.planTitle}」的旅途中，每一步都充满了惊喜。`,
        '从晨光微露到夕阳西下，我们一起走过了这座城市最美的角落。',
        '那些欢笑声、那些不经意间的感动，都成为了最珍贵的记忆。',
      ],
      highlights: [
        { icon: 'footprints', label: '足迹', value: `${params.checkInCount} 个地点` },
        { icon: 'heart', label: '快乐指数', value: '98%' },
        { icon: 'star', label: '最佳时刻', value: '每一刻' },
        { icon: 'camera', label: '精选瞬间', value: '全程精彩' },
      ],
    };
  }
}

export async function generateAIStory(params: {
  planId?: string;
  planTitle: string;
  activities: string[];
  moodText?: string;
  checkInCount: number;
  template?: string;
}): Promise<AIStoryContent> {
  return withServerFallback(
    () => generateStoryViaServer(params),
    () => generateAIStoryLocally(params),
    'story generation'
  );
}
