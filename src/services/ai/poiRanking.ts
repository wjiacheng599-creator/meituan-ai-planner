/**
 * POI Ranking - 个性化 POI 排序
 *
 * 基于用户画像对高德搜索结果进行个性化排序，
 * 并应用多样性控制避免推荐单一。
 */

import type { UnifiedUserProfile } from './unifiedProfile';

// ── 类型定义 ──

interface POIItem {
  name: string;
  type: string;
  address?: string;
  distance?: string;
  rating?: string;
  cost?: string;
}

export interface RankedPOI extends POIItem {
  personalScore: number; // 0-100，个性化匹配度
  diversityScore: number; // 0-100，多样性贡献
  finalScore: number; // 综合排序分数
  matchReasons: string[]; // 匹配原因（用于展示）
}

// ── 个性化排序 ──

export function rankPOIs(
  pois: POIItem[],
  userProfile: UnifiedUserProfile,
  context?: {
    city?: string;
    timeOfDay?: string;
    groupSize?: number;
  }
): RankedPOI[] {
  return pois
    .map((poi) => {
      let score = 50; // 基础分 50
      const reasons: string[] = [];

      // 1. 评分权重 (20%)
      const rating = parseFloat(poi.rating || '0');
      if (rating > 0) {
        const ratingScore = (rating / 5) * 20;
        score += ratingScore;
        if (rating >= 4.5) reasons.push('高评分');
      }

      // 2. 偏好匹配 (30%)
      // 类别匹配
      const poiText = `${poi.name} ${poi.type}`.toLowerCase();
      const matchedCategories = userProfile.activityPreferences.topCategories.filter((cat) =>
        poiText.includes(cat.toLowerCase())
      );
      if (matchedCategories.length > 0) {
        score += 15;
        reasons.push(`符合偏好：${matchedCategories[0]}`);
      }

      // 显式喜好匹配
      const matchedFavorites = userProfile.favoriteCategories.filter((cat) =>
        poiText.includes(cat.toLowerCase())
      );
      if (matchedFavorites.length > 0) {
        score += 10;
        reasons.push('你标记的喜好');
      }

      // 回避类别检查
      const matchedAvoids = userProfile.avoidCategories.filter((cat) =>
        poiText.includes(cat.toLowerCase())
      );
      if (matchedAvoids.length > 0) {
        score -= 20;
        reasons.push('你标记的回避');
      }

      // 3. 价格匹配 (15%)
      const poiCost = parseFloat(poi.cost || '0');
      if (poiCost > 0) {
        const [minPrice, maxPrice] = userProfile.budgetProfile.range;
        if (poiCost >= minPrice && poiCost <= maxPrice) {
          score += 15;
          reasons.push('符合预算');
        } else if (poiCost > maxPrice * 1.5) {
          score -= 10;
        }
      }

      // 4. 饮食限制检查 (10%)
      if (userProfile.dietaryRestrictions.length > 0) {
        const hasRestriction = userProfile.dietaryRestrictions.some((r) =>
          poiText.includes(r.toLowerCase())
        );
        if (hasRestriction) {
          score -= 15;
          reasons.push('可能不符合饮食限制');
        }
      }

      // 5. 品牌偏好 (10%)
      const matchedBrands = userProfile.brandPreferences.favoriteBrands.filter((brand) =>
        poi.name.includes(brand)
      );
      if (matchedBrands.length > 0) {
        score += 10;
        reasons.push('你常去的品牌');
      }

      const matchedAvoidBrands = userProfile.brandPreferences.avoidedBrands.filter((brand) =>
        poi.name.includes(brand)
      );
      if (matchedAvoidBrands.length > 0) {
        score -= 10;
      }

      // 6. 距离因素 (5%)
      const distance = parseFloat(poi.distance || '0');
      if (distance > 0) {
        if (distance < 500) score += 5;
        else if (distance < 1000) score += 3;
        else if (distance < 2000) score += 1;
      }

      // 确保分数在 0-100 范围内
      score = Math.min(100, Math.max(0, score));

      return {
        ...poi,
        personalScore: Math.round(score),
        diversityScore: 0, // 后续计算
        finalScore: 0, // 后续计算
        matchReasons: reasons.slice(0, 3), // 最多 3 个原因
      };
    })
    .sort((a, b) => b.personalScore - a.personalScore);
}

// ── 多样性控制 ──

export function applyDiversityControl(ranked: RankedPOI[], limit: number = 10): RankedPOI[] {
  const result: RankedPOI[] = [];
  const usedCategories = new Map<string, number>();

  for (const poi of ranked) {
    if (result.length >= limit) break;

    // 提取类别（从 type 字段）
    const category = extractCategory(poi.type, poi.name);

    // 同类别的 POI 最多选 2 个
    const categoryCount = usedCategories.get(category) || 0;
    if (categoryCount >= 2) continue;

    // 计算多样性分数
    const diversityScore = categoryCount === 0 ? 100 : 50;

    result.push({
      ...poi,
      diversityScore,
      finalScore: Math.round(poi.personalScore * 0.7 + diversityScore * 0.3),
    });

    usedCategories.set(category, categoryCount + 1);
  }

  // 按 finalScore 重新排序
  return result.sort((a, b) => b.finalScore - a.finalScore);
}

// ── 工具函数 ──

function extractCategory(type: string, name: string): string {
  const text = `${type} ${name}`.toLowerCase();

  // 餐饮类
  if (
    text.includes('餐厅') ||
    text.includes('饭店') ||
    text.includes('火锅') ||
    text.includes('烧烤') ||
    text.includes('小吃') ||
    text.includes('咖啡') ||
    text.includes('茶') ||
    text.includes('甜品') ||
    text.includes('面包')
  ) {
    return '餐饮';
  }

  // 景点类
  if (
    text.includes('景点') ||
    text.includes('公园') ||
    text.includes('博物馆') ||
    text.includes('景区') ||
    text.includes('古迹') ||
    text.includes('纪念馆')
  ) {
    return '景点';
  }

  // 购物类
  if (
    text.includes('商场') ||
    text.includes('超市') ||
    text.includes('便利店') ||
    text.includes('市场') ||
    text.includes('店铺')
  ) {
    return '购物';
  }

  // 娱乐类
  if (
    text.includes('电影') ||
    text.includes('KTV') ||
    text.includes('游戏') ||
    text.includes('酒吧') ||
    text.includes('俱乐部')
  ) {
    return '娱乐';
  }

  // 住宿类
  if (
    text.includes('酒店') ||
    text.includes('宾馆') ||
    text.includes('民宿') ||
    text.includes('旅馆')
  ) {
    return '住宿';
  }

  return '其他';
}

// ── 导出排序结果为 prompt 上下文 ──

export function rankedPOIsToPromptContext(
  ranked: RankedPOI[],
  city: string,
  limit: number = 10
): string {
  const topPOIs = ranked.slice(0, limit);

  if (topPOIs.length === 0) return '';

  const lines = topPOIs.map((poi, i) => {
    const reasons = poi.matchReasons.length > 0 ? ` (${poi.matchReasons[0]})` : '';
    const price = poi.cost ? `人均¥${poi.cost}` : '';
    const rating = poi.rating ? `评分${poi.rating}` : '';
    const meta = [rating, price].filter(Boolean).join(' ');

    return `${i + 1}. ${poi.name} - ${poi.address || ''} ${meta}${reasons}`;
  });

  return `【${city}推荐地点】（已按偏好排序）\n${lines.join('\n')}`;
}
