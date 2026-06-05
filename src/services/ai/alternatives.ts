import { getActivityImage } from '../imageLibrary';
import { batchFetchPOIImages } from '../poiImageService';
import { generateAlternativesViaServer } from '../serverApi';
import { withServerFallback } from '../../utils/withServerFallback';
import { Activity } from './types';
import { sanitizeUserInput, callDashScope } from './core';
import { fallbackImages } from './utils';

export async function generateAlternativesLocally(
  currentActivity: Activity,
  reason: string
): Promise<Activity[]> {
  // Sanitize user inputs to prevent prompt injection
  reason = sanitizeUserInput(reason);
  const sanitizedActivity = {
    ...currentActivity,
    title: sanitizeUserInput(currentActivity.title),
    description: sanitizeUserInput(currentActivity.description),
  };

  const systemPrompt = `你是美团本地生活 AI 助手。用户想替换行程中的一个活动，推荐 3 个替代选择。
要求：类型相似但有差异化，价格±30%，每个有独特亮点。
返回 JSON 数组：
[{"id":"alt_1","timeLine":"14:30-16:30","title":"替代地点","type":"activity","description":"推荐理由","price":100,"distanceInfo":"距离 1.2km","tags":["标签1","标签2"]}]`;

  const userPrompt = `当前活动：${sanitizedActivity.title}（${sanitizedActivity.type}）
描述：${sanitizedActivity.description}
价格：¥${sanitizedActivity.price}
时间：${sanitizedActivity.timeLine}
替换原因：${reason}`;

  try {
    const rawText = await callDashScope(systemPrompt, userPrompt, true);
    const alts = JSON.parse(rawText) as Activity[];
    const normalized = alts.map((a, i) => ({
      ...a,
      id: `alt_${Date.now()}_${i}`,
      imageUrl:
        getActivityImage(
          {
            id: a.id || `alt_${i}`,
            title: a.title,
            description: a.description,
            type: a.type,
            tags: a.tags || [],
          },
          i
        ) ||
        fallbackImages[String(i + 1)] ||
        fallbackImages['1'],
    }));
    if (normalized.length > 0) {
      return normalized;
    }
  } catch {}

  const reasonTag = /天气/.test(reason)
    ? '室内更稳'
    : /排队/.test(reason)
      ? '避开排队'
      : /餐厅/.test(reason)
        ? '同商圈备选'
        : '顺路替换';
  const typeLabel =
    currentActivity.type === 'food'
      ? '餐厅'
      : currentActivity.type === 'activity'
        ? '去处'
        : '路线点';
  const basePrice = Math.max(20, currentActivity.price || 88);
  const baseTitle = currentActivity.title.replace(/[·\-\s].*$/, '').trim() || currentActivity.title;
  const variants = [
    {
      suffix: currentActivity.type === 'food' ? '同商圈口碑餐厅' : '轻松备选点',
      description: `保留原本节奏，换成更容易直接出发的${typeLabel}。`,
      delta: -18,
      distance: '0.8km',
      tags: [reasonTag, '更好执行'],
    },
    {
      suffix: currentActivity.type === 'food' ? '排队更短的选择' : '顺路替代方案',
      description: `优先减少等待和绕路，适合继续当前行程。`,
      delta: 8,
      distance: '1.2km',
      tags: ['节奏更顺', '继续当前安排'],
    },
    {
      suffix: currentActivity.type === 'food' ? '体验更稳的备选' : '体验升级点',
      description: `在相近预算内换成体验更稳定的一站。`,
      delta: 22,
      distance: '1.6km',
      tags: ['体验稳定', '可直接切换'],
    },
  ];

  const alts = variants.map((variant, index) => {
    const price = Math.max(20, basePrice + variant.delta);
    return {
      ...currentActivity,
      id: `alt_local_${Date.now()}_${index}`,
      title: `${baseTitle}${variant.suffix}`,
      description: variant.description,
      price,
      distanceInfo: `距离当前路线约 ${variant.distance}`,
      tags: [...variant.tags, currentActivity.type === 'food' ? '替代餐饮' : '替代点位'],
      imageUrl:
        getActivityImage(
          {
            id: `alt_local_${index}`,
            title: `${baseTitle}${variant.suffix}`,
            description: variant.description,
            type: currentActivity.type,
            tags: variant.tags,
          },
          index
        ) ||
        fallbackImages[String(index + 1)] ||
        fallbackImages['1'],
    };
  });

  try {
    const imageMap = await batchFetchPOIImages(alts.map((a) => ({ name: a.title })));
    return alts.map((a) => {
      const realUrl = imageMap.get(a.title);
      return realUrl ? { ...a, imageUrl: realUrl } : a;
    });
  } catch {
    return alts;
  }
}

export async function generateAlternatives(
  currentActivity: Activity,
  reason: string
): Promise<Activity[]> {
  return withServerFallback(
    () => generateAlternativesViaServer({ currentActivity, reason }),
    () => generateAlternativesLocally(currentActivity, reason),
    'alternatives'
  );
}
