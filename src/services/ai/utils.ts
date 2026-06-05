// [PERF-OPT] Simple hash function for caching (not cryptographic)
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}

// [PERF-OPT] Estimate tokens (Chinese text ~2 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

export function fixJsonQuotes(text: string): string {
  return text
    .replace(/'([^']+)'/g, '"$1"')
    .replace(/：/g, ':')
    .replace(/，/g, ',');
}

export function attemptJsonRepair(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    try {
      return JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          const fixed = fixJsonQuotes(jsonMatch[0]);
          return JSON.parse(fixed);
        }
      }
    }
  }

  return null;
}

export function extractPartialContent(text: string): {
  content?: string;
  suggestedActions?: string[];
} {
  const result: { content?: string; suggestedActions?: string[] } = {};

  const contentMatch = text.match(/"content"\s*:\s*"([^"]+)"/);
  if (contentMatch) {
    result.content = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  } else {
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 10);
    if (paragraphs.length > 0) {
      result.content = paragraphs.slice(0, 3).join('\n');
    }
  }

  const actionsMatch = text.match(/"suggestedActions"\s*:\s*\[([^\]]+)\]/);
  if (actionsMatch) {
    const actions = actionsMatch[1].match(/"([^"]+)"/g);
    if (actions) {
      result.suggestedActions = actions.map((a) => a.replace(/"/g, ''));
    }
  }

  return result;
}

export const DEFAULT_POI_RATING = '4.5';
export const DEFAULT_RESTAURANT_COST = 68;
export const DEFAULT_ACTIVITY_COST = 88;
export const MIN_DISTANCE_KM = 0.1;

export function formatPoiDistance(distance?: string): string {
  if (!distance || Number.isNaN(Number(distance))) return '附近';
  return `${Math.max(MIN_DISTANCE_KM, Number(distance) / 1000).toFixed(1)}km`;
}

export function inferSearchKeywords(query: string): { food: string; activity: string } {
  // 拍照相关 → 美术馆/展览 + 咖啡馆
  if (/拍照|摄影|打卡|网红/.test(query)) {
    return { food: '咖啡馆 餐厅', activity: '美术馆 展览 公园' };
  }
  if (/咖啡|下午茶|甜品/.test(query)) {
    return { food: '咖啡馆 下午茶', activity: '美术馆 展览 公园' };
  }
  if (/约会|情侣/.test(query)) {
    return { food: '约会餐厅 咖啡馆', activity: '展览 江边 公园' };
  }
  if (/亲子|孩子|家庭/.test(query)) {
    return { food: '亲子餐厅', activity: '动物园 乐园 科技馆' };
  }
  if (/安静|放松|散步|citywalk/.test(query)) {
    return { food: '安静咖啡馆', activity: '公园 书店 展览' };
  }
  // 避暑/户外/自然
  if (/避暑|户外|自然|徒步|爬山|山水/.test(query)) {
    return { food: '农家乐 山庄餐厅', activity: '景区 山 公园 湖泊' };
  }
  // 逛街/购物
  if (/逛街|购物|商场/.test(query)) {
    return { food: '餐厅 美食', activity: '商场 步行街' };
  }
  // 夜生活/酒吧
  if (/酒吧|夜生活|喝酒/.test(query)) {
    return { food: '餐厅 夜宵', activity: '酒吧街 夜市' };
  }
  // 目的地搜索：提取用户想去的地点，用地点名作为 activity 关键词
  const placeMatch = query.match(/去([\u4e00-\u9fa5]+)/);
  if (placeMatch) {
    const place = placeMatch[1];
    console.log('[inferSearchKeywords] 提取目的地:', place, '←', query);
    return { food: `${place}附近餐厅`, activity: place };
  }
  console.log('[inferSearchKeywords] 无匹配，使用默认关键词 ←', query);
  return { food: '特色餐厅 咖啡馆', activity: '展览 景点 公园' };
}

export const fallbackImages: Record<string, string> = {
  '1': 'gradient:blue-purple',
  '2': 'gradient:orange-red',
  '3': 'gradient:green-teal',
  '4': 'gradient:indigo-blue',
  '5': 'gradient:pink-yellow',
};
