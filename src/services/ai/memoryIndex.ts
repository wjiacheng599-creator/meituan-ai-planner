/**
 * MemoryIndex - 轻量级本地 RAG 检索引擎
 * 零外部依赖，纯 JS TF-IDF + 关键词匹配
 */
import type { Plan } from './types';
import type { PersonProfile, PlannerTaskState } from '../../types';
import type { CopilotMessage } from './types';

interface IndexDocument {
  id: string;
  content: string;
  keywords: string[];
  source: string;
  priority: number;
}

interface SearchResult {
  content: string;
  score: number;
  source: string;
}

class MemoryIndex {
  private docs: IndexDocument[] = [];
  private built = false;

  build(
    plans: Plan[],
    taskStates: PlannerTaskState[],
    profiles: PersonProfile[],
    copilotMessages: CopilotMessage[],
    travelDNA?: {
      styleTags: string[];
      budgetProfile: { avgPerPerson: number; sensitivity: string };
      timePreferences: { preferredStart: string };
    }
  ): void {
    this.docs = [];

    for (const plan of plans.slice(-10)) {
      const activities = plan.activities.map((a) => a.title + '(' + a.type + ')').join(', ');
      this.docs.push({
        id: 'plan_' + (plan.id || ''),
        content:
          '行程: ' +
          (plan.title || '') +
          ' - ' +
          activities +
          ', 总价' +
          (plan.totalPrice || 0) +
          ', 城市' +
          (plan.city || ''),
        keywords: [...(plan.tags || []), plan.city || '', ...plan.activities.map((a) => a.title)],
        source: 'history',
        priority: 3,
      });
    }

    const completedNames: string[] = [];
    for (const ts of taskStates) {
      for (const actId of ts.completedActivityIds || []) {
        const plan = plans.find((p) => p.id === ts.planId);
        const act = plan?.activities.find((a) => a.id === actId);
        completedNames.push(act ? act.title : actId);
      }
    }
    if (completedNames.length) {
      this.docs.push({
        id: 'completed',
        content: '已完成: ' + completedNames.slice(0, 10).join(', '),
        keywords: completedNames.slice(0, 10),
        source: 'completed',
        priority: 4,
      });
    }
    const bookedNames: string[] = [];
    for (const ts of taskStates) {
      for (const actId of ts.bookedActivityIds || []) {
        const plan = plans.find((p) => p.id === ts.planId);
        const act = plan?.activities.find((a) => a.id === actId);
        bookedNames.push(act ? act.title : actId);
      }
    }
    if (bookedNames.length) {
      this.docs.push({
        id: 'booked',
        content: '已预订: ' + bookedNames.slice(0, 10).join(', '),
        keywords: bookedNames.slice(0, 10),
        source: 'booked',
        priority: 5,
      });
    }

    for (const p of profiles) {
      const prefs = [...p.travelPreferences, ...p.dietaryPreferences];
      this.docs.push({
        id: 'profile_' + p.id,
        content: p.name + '(' + p.relation + ',' + p.ageGroup + '): 偏好' + prefs.join(', '),
        keywords: [p.relation, p.ageGroup, ...prefs],
        source: 'profile',
        priority: 2,
      });
    }

    const recentUserMsgs = copilotMessages.filter((m) => m.role === 'user').slice(-5);
    if (recentUserMsgs.length) {
      this.docs.push({
        id: 'recent_chat',
        content:
          '最近对话: ' +
          recentUserMsgs
            .map((m) => (typeof m.content === 'string' ? m.content : ''))
            .filter(Boolean)
            .join('; '),
        keywords: recentUserMsgs.flatMap((m) =>
          typeof m.content === 'string' ? m.content.split(/[,,\s]+/) : []
        ),
        source: 'chat',
        priority: 1,
      });
    }

    if (travelDNA && travelDNA.styleTags.length > 0) {
      const budgetLabel = travelDNA.budgetProfile.sensitivity === 'high' ? '预算敏感' : '预算中等';
      this.docs.push({
        id: 'dna',
        content:
          '用户画像: ' +
          travelDNA.styleTags.join(', ') +
          ', ' +
          budgetLabel +
          ', 偏好' +
          travelDNA.timePreferences.preferredStart +
          '出行',
        keywords: travelDNA.styleTags,
        source: 'dna',
        priority: 2,
      });
    }

    this.built = true;
  }

  search(query: string, k = 5): SearchResult[] {
    if (!this.built) return [];
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    const scored = this.docs.map((doc) => {
      const docTerms = this.tokenize(doc.content);
      let score = 0;
      for (const qt of queryTerms) {
        const count = docTerms.filter((t) => t === qt).length;
        if (count > 0) score += count;
      }
      for (const qt of queryTerms) {
        if (doc.keywords.some((k) => k.includes(qt) || qt.includes(k))) {
          score += 2;
        }
      }
      score *= 1 + doc.priority * 0.1;
      return { content: doc.content, score, source: doc.source };
    });

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  toContext(query: string, k = 5): string {
    const results = this.search(query, k);
    if (results.length === 0) return '';
    return '\n' + results.map((r) => '[' + r.source + '] ' + r.content).join('\n');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
  }
}

export const memoryIndex = new MemoryIndex();
