/**
 * useHomeChat - Home 页聊天消息管理 hook
 *
 * 从 Home.tsx 中提取的聊天相关逻辑：
 * - 消息列表管理（messages）
 * - 输入框状态（query）
 * - 规划模式（isPlanMode）
 * - AI 对话 / 意图识别 / 服务卡片 / 行程生成
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { Plan, Activity, PlanningContext } from '../services/ai';
import {
  generatePlan,
  compareWithAI,
  type CompareResult,
  detectIntent,
  handleServiceIntent,
  fetchWeather,
  getUserCity,
  searchDestinations,
  detectIntentHybrid,
} from '../services/ai';
import { generateTravelDNA } from '../services/ai/travelDNA';
import { chatInHome } from '../services/ai/homeChat';
import { recommendCards } from '../services/ai/cardRecommender';
import { parseInputForRequirements } from '../services/ai/intent';
import { parseTimeUrgency, parseImplicitBudget } from '../services/ai/intent';
import type { PersonProfile, PlannerTaskState, TaskSession } from '../types';
import type {
  WeatherCardData,
  RestaurantCardData,
  DeliveryCardData,
  TicketCardData,
  CouponCardData,
} from '../components/cards/ServiceCards';
import type { TaxiCardData } from '../components/cards/TaxiCard';
import type { ChatMessage } from '../components/screens/home/SessionList';
import type { PipelineStep } from '../components/screens/home/PipelineProgress';

// ── 工具函数（从 Home.tsx 移入） ──

function getLatestPlanFromMessages(messages: ChatMessage[]): Plan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'plan' && messages[i].plan) {
      return messages[i].plan || null;
    }
  }
  return null;
}

/**
 * 从用户文本中提取出行人数
 * 支持：3个人、两人、一家三口、情侣、我和朋友2人、5位、单独、solo 等
 * 返回提取到的数字，未找到则返回 null
 */
function extractPeopleCountFromText(text: string): number | null {
  // 明确数字 + 人/位/个
  const numMatch = text.match(/(\d+)\s*[个人位]/);
  if (numMatch) return parseInt(numMatch[1], 10);

  // 中文数字
  if (/[一1][家][三口三四五]/.test(text) || /一家[三四五]口/.test(text)) return 3;
  if (/一家[两二]口/.test(text)) return 2;
  if (/两人|二位|情侣|两口|我和ta|我和他|我和她|俩/.test(text)) return 2;
  if (/三人|三口/.test(text)) return 3;
  if (/四人|四口/.test(text)) return 4;
  if (/五人|五口/.test(text)) return 5;
  if (/一个人|单独|独自|solo|我[独自个]|自己/.test(text)) return 1;
  if (/和朋友/.test(text)) return 2; // "和朋友"默认2人
  if (/带娃|带孩子|带小孩|亲子/.test(text)) return 2; // 亲子默认1大人+1小孩

  return null;
}

function analyzeIntentFromProfiles(text: string, profiles: PersonProfile[]): string {
  const keywords = text.match(/[\u4e00-\u9fa5]+/g) || [];
  const interests = keywords.slice(0, 3).join('、') || '休闲出行';

  // 优先从文本提取人数，否则用档案人数，最低为1
  const extractedCount = extractPeopleCountFromText(text);
  const memberCount = extractedCount ?? (profiles.length || 1);

  const hasElderly = profiles.some((p) => p.ageGroup === '老年');
  const hasChild = profiles.some((p) => p.ageGroup === '儿童');
  let extra = '';
  if (hasElderly) extra += '，已识别长辈需求';
  if (hasChild) extra += '，已适配儿童友好场所';
  if (extractedCount && extractedCount !== profiles.length) {
    extra += `（从输入中识别到${extractedCount}人）`;
  }
  return `识别到${memberCount}位出行成员，核心需求：${interests}${extra}`;
}

function buildExecutionReadiness(
  plan: Plan,
  weather?: { city: string; temp: number; condition: string; advice: string },
  strategyLabel?: string
): Plan['executionReadiness'] {
  const checks: NonNullable<Plan['executionReadiness']>['checks'] = [];
  const hasMeal = plan.activities.some((a) => a.type === 'food');
  const totalPrice = plan.totalPrice || 0;

  checks.push({
    label: '路线完整度',
    status: plan.activities.length >= 3 ? 'ok' : 'warning',
    detail:
      plan.activities.length >= 3 ? '已覆盖玩乐、餐饮和衔接环节' : '活动点较少，建议补一个备用去处',
  });
  checks.push({
    label: '餐饮安排',
    status: hasMeal ? 'ok' : 'warning',
    detail: hasMeal ? '已包含用餐节点' : '当前路线缺少明确用餐点',
  });
  checks.push({
    label: '预算检查',
    status: totalPrice <= 600 ? 'ok' : totalPrice <= 900 ? 'warning' : 'risk',
    detail: `当前总预算约 ¥${totalPrice}`,
  });

  if (weather) {
    const badWeather = /雨|雪|雷|雾/.test(weather.condition);
    const hasOutdoor = plan.activities.some((a) => a.type === 'activity');
    checks.push({
      label: '天气风险',
      status: badWeather && hasOutdoor ? 'warning' : 'ok',
      detail: `${weather.city}${weather.condition}`,
    });
  }

  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const riskCount = checks.filter((c) => c.status === 'risk').length;
  const status = riskCount > 0 ? 'risk' : warningCount > 0 ? 'adjust' : 'ready';
  const summary =
    status === 'ready'
      ? `这条方案可以直接确认执行${strategyLabel ? `，当前采用${strategyLabel}` : ''}。`
      : status === 'adjust'
        ? '这条方案基本可执行，但建议在确认前微调 1-2 项。'
        : '这条方案存在明显执行风险，建议先切换更稳妥的备选。';

  return {
    status,
    summary,
    checks,
    fallbackOptions: [
      { label: '餐厅无位', detail: '自动切换同商圈同价位备选餐厅' },
      { label: '排队过长', detail: '先去附近活动点，吃饭顺延' },
      { label: '天气突变', detail: '优先替换为室内点位' },
    ],
  };
}

// ── DynamicSuggestionCard 类型 ──

export interface DynamicSuggestionCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
  prompt: string;
  topicKey: string;
}

// ── CollabSummary 类型 ──

export interface CollabSummary {
  counts?: Map<string, number>;
  consensus: string[];
  conflicts: string[];
  missingMembers?: PersonProfile[];
  memberSummaries: Array<{
    id: string;
    name: string;
    relation: string;
    votes: string[];
    avoids?: string[];
  }>;
  strategyLabel: string;
  analysisText: string;
  topAvoids: string[];
  tieBreakerLabel: string;
}

// ── Hook 输入参数 ──

interface UseHomeChatParams {
  profiles: PersonProfile[];
  savedPlans: Plan[];
  plannerTaskStates: PlannerTaskState[];
  taskSessions: TaskSession[];
  activeSessionId: string | null;
  combinedProfiles: PersonProfile[];
  selectedProfiles: PersonProfile[];
  selectedProfileIds: Set<string>;
  collabSummary: CollabSummary;
  isPlanMode: boolean;
  setIsPlanMode: (v: boolean) => void;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  timePref: string;
  targetType: string;
  onSavePlan: (plan: Plan) => void;
  persistActiveSession: (patch: Partial<TaskSession>, sessionId?: string | null) => void;
  activeSessionPlan: Plan | null;
  recentCardKeys: string[];
  addRecentCardKeys: (keys: string[]) => void;
  /** 实时 collab 数据 ref（解决 hook 顺序问题） */
  collabDataRef?: React.RefObject<{
    selectedProfiles: PersonProfile[];
    combinedProfiles: PersonProfile[];
    collabSummary: CollabSummary;
    collabStrategy: 'balanced' | 'care' | 'efficient';
    timePref: string;
    targetType: string;
    selectedProfileIds: Set<string>;
  }>;
  initialMessages?: ChatMessage[];
  initialQuery?: string;
}

// ── Hook 返回值 ──

interface UseHomeChatReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  planningInProgressRef: React.MutableRefObject<boolean>;
  appendMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  handleUpdateWeatherMessage: (msgId: string, data: WeatherCardData) => void;
  handleStartPlan: (text?: string, forcePlan?: boolean) => Promise<void>;
  handleGuideImport: () => void;
  showImportGuide: boolean;
  setShowImportGuide: React.Dispatch<React.SetStateAction<boolean>>;
  showAttachMenu: boolean;
  setShowAttachMenu: React.Dispatch<React.SetStateAction<boolean>>;
  guideText: string;
  setGuideText: React.Dispatch<React.SetStateAction<string>>;
  suggestionCards: DynamicSuggestionCard[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function useHomeChat(params: UseHomeChatParams): UseHomeChatReturn {
  const {
    profiles,
    savedPlans,
    plannerTaskStates,
    taskSessions,
    activeSessionId,
    combinedProfiles: _combinedProfiles,
    selectedProfiles: _selectedProfiles,
    selectedProfileIds: _selectedProfileIds,
    collabSummary: _collabSummary,
    isPlanMode,
    setIsPlanMode,
    collabStrategy: _collabStrategy,
    timePref: _timePref,
    targetType: _targetType,
    onSavePlan,
    persistActiveSession,
    activeSessionPlan,
    collabDataRef,
    initialMessages = [],
    initialQuery = '',
  } = params;

  // 使用 ref 获取最新的 collab 数据（解决 hook 顺序问题）
  const getCollabData = useCallback(() => {
    if (collabDataRef?.current) {
      return collabDataRef.current;
    }
    return {
      selectedProfiles: _selectedProfiles,
      combinedProfiles: _combinedProfiles,
      collabSummary: _collabSummary,
      collabStrategy: _collabStrategy,
      timePref: _timePref,
      targetType: _targetType,
      selectedProfileIds: _selectedProfileIds,
    };
  }, [
    collabDataRef,
    _selectedProfiles,
    _combinedProfiles,
    _collabSummary,
    _collabStrategy,
    _timePref,
    _targetType,
    _selectedProfileIds,
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [query, setQuery] = useState(initialQuery);
  const [isRecording, setIsRecording] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [guideText, setGuideText] = useState('');
  const planningInProgressRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const persistRef = useRef(persistActiveSession);
  persistRef.current = persistActiveSession;

  // 消息变化时保存到 session
  useEffect(() => {
    if (messages.length > 0) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        persistActiveSession({ messages: messages as any }, activeSessionId);
      }, 300);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, activeSessionId, persistActiveSession]);

  // 卸载时通过 ref 确保消息被保存
  useEffect(() => {
    return () => {
      const latest = messagesRef.current;
      if (latest.length > 0) {
        persistRef.current({ messages: latest as any }, activeSessionIdRef.current);
      }
    };
  }, []);

  const appendMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    if (typeof updater !== 'function') {
      console.error('[appendMessages] updater is not a function:', updater);
      return;
    }
    setMessages((prev) => updater(prev));
  }, []);

  const handleUpdateWeatherMessage = useCallback((msgId: string, data: WeatherCardData) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, weatherData: data } : m)));
  }, []);

  // ── 主聊天/规划入口 ──
  const handleStartPlan = useCallback(
    async (text: string = query, forcePlan?: boolean) => {
      if (planningInProgressRef.current) return;
      if (!text.trim()) return;
      persistActiveSession({ queryDraft: '' });

      planningInProgressRef.current = true;
      const sessionSnapshot = activeSessionId;
      const isSessionCurrent = () => sessionSnapshot === activeSessionIdRef.current;
      const stopIfSessionChanged = () => {
        if (isSessionCurrent()) return false;
        planningInProgressRef.current = false;
        return true;
      };

      // 获取最新的 collab 数据
      const {
        selectedProfiles,
        combinedProfiles,
        collabSummary,
        collabStrategy,
        timePref,
        targetType,
        selectedProfileIds,
      } = getCollabData();

      let constructedQuery = text;
      if (isPlanMode) {
        const peopleStr = selectedProfiles
          .map((p) => {
            const parts = [
              p.name,
              p.relation,
              p.ageGroup,
              p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : '',
              p.dietaryPreferences?.length ? `饮食:${p.dietaryPreferences.join(',')}` : '',
              p.travelPreferences?.length ? `偏好:${p.travelPreferences.join(',')}` : '',
              p.avoidPreferences?.length ? `避雷:${p.avoidPreferences.join(',')}` : '',
              p.specialNeeds?.length ? `特殊需求:${p.specialNeeds.join(',')}` : '',
              p.budget ? `预算:${p.budget}` : '',
              p.mobility && p.mobility !== '正常' ? `体力:${p.mobility}` : '',
              p.favoriteActivities?.length ? `喜欢:${p.favoriteActivities.join(',')}` : '',
            ].filter(Boolean);
            return `【${parts.join(', ')}】`;
          })
          .join('\n');
        const memberVoteText = collabSummary.memberSummaries
          .map((m) => `${m.name}：${m.votes.join('、') || '暂未投票'}`)
          .join('\n');
        const memberAvoidText = collabSummary.memberSummaries
          .map((m) => `${m.name} 避雷：${m.avoids?.join('、') || '无明显避雷'}`)
          .join('\n');
        const conflictText =
          collabSummary.conflicts.length > 0 ? collabSummary.conflicts.join('；') : '暂无明显冲突';
        const strategyLabel =
          collabStrategy === 'balanced'
            ? '民主共识：平衡所有人需求'
            : collabStrategy === 'care'
              ? '照顾模式：优先满足弱势成员'
              : '效率优先：最大化体验密度';
        const urgency = parseTimeUrgency(text);
        const budget = parseImplicitBudget(text);
        let extraHints = '';
        if (urgency.urgent) extraHints += `\n【时间紧迫度】：${urgency.hint}`;
        if (budget.detected) extraHints += `\n【预算信号】：${budget.hint}`;
        constructedQuery = `深度规划请求：\n【同行人】：${peopleStr}\n【出发时间】：${timePref}\n【目标范围】：${targetType}\n【决策策略】：${strategyLabel}\n【成员投票】：\n${memberVoteText}\n【成员避雷】：\n${memberAvoidText}\n【当前共识】：${collabSummary.consensus.join('、') || '请你根据成员信息主动归纳'}\n【共同避雷】：${collabSummary.topAvoids.join('、') || '无'}\n【待平衡冲突】：${conflictText}\n【冲突裁决优先级】：${collabSummary.tieBreakerLabel}${extraHints}\n附加要求：${text || '无'}`;
      }

      const genId = (Date.now() + 1).toString();
      appendMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), type: 'user', content: text },
      ]);

      if (forcePlan) constructedQuery = `请规划一条出行路线：${text}`;

      // 使用混合意图识别
      const hybridResult = forcePlan
        ? { intent: { type: 'plan' as const, query: text }, source: 'rule' as const }
        : await detectIntentHybrid(text);
      if (stopIfSessionChanged()) return;
      const intent = hybridResult.intent;

      // ── 打车意图检测 ──
      const taxiRegex = /打车|叫车|叫辆[车出租]|出租车|滴滴|网约车|去打车/;
      if (taxiRegex.test(text) && !forcePlan) {
        const pipeId = genId + '_taxi_pipe';
        appendMessages((prev) => [
          ...prev,
          {
            id: pipeId,
            type: 'pipeline',
            pipelineTitle: '正在为你查询...',
            pipelineSteps: [
              { id: 'v1', title: '理解你的需求', icon: null, status: 'done' },
              { id: 'v2', title: '查找附近车辆', icon: null, status: 'running' },
            ],
            pipelineCollapsed: false,
          },
        ]);
        setQuery('');
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (stopIfSessionChanged()) return;
        const latestPlan = getLatestPlanFromMessages(messages);
        const firstActivity = latestPlan?.activities?.[0];
        const taxiData: TaxiCardData = {
          destinationName: firstActivity?.title || '请设置目的地',
          lat: firstActivity?.lat,
          lng: firstActivity?.lng,
          distanceMeters: 3600,
          durationMinutes: 17,
          activityTimeLine: firstActivity?.timeLine,
        };
        const taxiMsg: ChatMessage = {
          id: genId + '_taxi',
          type: 'taxi',
          taxiData,
        };
        setMessages((prev) => [
          ...prev.map((m) =>
            m.id === pipeId
              ? {
                  ...m,
                  pipelineTitle: '查询完成',
                  pipelineSummary: '已找到附近可用车辆',
                  pipelineCollapsed: true,
                }
              : m
          ),
          taxiMsg,
        ]);
        planningInProgressRef.current = false;
        return;
      }

      // ── 对比意图 ──
      if (intent.type === 'compare' && !forcePlan) {
        const pipeId = genId + '_cmp_pipe';
        const compareSteps: PipelineStep[] = [
          { id: 'c1', title: '解析对比对象', icon: null, status: 'done' },
          { id: 'c2', title: 'AI 多维分析', icon: null, status: 'running' },
        ];
        appendMessages((prev) => [
          ...prev,
          {
            id: pipeId,
            type: 'pipeline',
            pipelineTitle: '正在对比分析...',
            pipelineSteps: compareSteps,
            pipelineCollapsed: false,
          },
        ]);
        setQuery('');
        try {
          const items = text
            .replace(/对比|哪个好|比较|和|，/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          if (items.length >= 2) {
            const result = await compareWithAI(items);
            if (!isSessionCurrent()) return;
            setMessages((prev) => [
              ...prev.map((m) =>
                m.id === pipeId
                  ? {
                      ...m,
                      pipelineTitle: '对比完成',
                      pipelineSummary: `已完成 ${items.slice(0, 2).join(' 和 ')} 的多维分析`,
                      pipelineCollapsed: true,
                    }
                  : m
              ),
              { id: genId + '_cmp', type: 'comparison', comparisonData: result },
            ]);
          } else {
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== pipeId),
              {
                id: genId + '_err',
                type: 'assistant',
                content: '请提供两个或更多商家名称进行对比',
              },
            ]);
          }
        } catch {
          if (stopIfSessionChanged()) return;
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== pipeId),
            { id: genId + '_err', type: 'assistant', content: '对比分析暂时不可用，请稍后重试。' },
          ]);
        } finally {
          planningInProgressRef.current = false;
        }
        return;
      }

      // ── 服务意图（天气/餐厅/外卖/票务/优惠券） ──
      if (intent.type !== 'plan' && intent.type !== 'chat') {
        const pipeId = genId + '_svc_pipe';
        appendMessages((prev) => [
          ...prev,
          {
            id: pipeId,
            type: 'pipeline',
            pipelineTitle: '正在为你查询...',
            pipelineSteps: [
              { id: 'v1', title: '理解你的需求', icon: null, status: 'done' },
              { id: 'v2', title: '获取实时数据', icon: null, status: 'running' },
            ],
            pipelineCollapsed: false,
          },
        ]);
        setQuery('');
        try {
          // 优先使用工具handler，否则回退到原始处理
          const result = hybridResult.toolHandler
            ? await hybridResult.toolHandler()
            : await handleServiceIntent(intent);
          if (stopIfSessionChanged()) return;
          const cardMsg: ChatMessage | null = result.cardType
            ? {
                id: genId + '_card',
                type: result.cardType as ChatMessage['type'],
                sourceQuery: text,
                ...(result.cardType === 'weather'
                  ? { weatherData: result.cardData as WeatherCardData }
                  : {}),
                ...(result.cardType === 'restaurant'
                  ? { restaurantData: result.cardData as RestaurantCardData[] }
                  : {}),
                ...(result.cardType === 'delivery'
                  ? { deliveryData: result.cardData as DeliveryCardData[] }
                  : {}),
                ...(result.cardType === 'ticket'
                  ? { ticketData: result.cardData as TicketCardData[] }
                  : {}),
                ...(result.cardType === 'coupon'
                  ? { couponData: result.cardData as CouponCardData[] }
                  : {}),
              }
            : null;
          setMessages((prev) => [
            ...prev.map((m) =>
              m.id === pipeId
                ? {
                    ...m,
                    pipelineTitle: '查询完成',
                    pipelineSummary: result.text,
                    pipelineCollapsed: true,
                  }
                : m
            ),
            ...(cardMsg
              ? [cardMsg]
              : [{ id: genId + '_svc', type: 'assistant' as const, content: result.text }]),
          ]);
        } catch {
          if (!isSessionCurrent()) return;
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== pipeId),
            { id: genId + '_err', type: 'assistant', content: '服务请求失败，请稍后重试。' },
          ]);
        } finally {
          planningInProgressRef.current = false;
        }
        return;
      }

      // ── Chat 意图 ──
      if (intent.type === 'chat') {
        const isVagueTripIntent =
          /想.*(出去|玩|逛|走走)|无聊|周末.*(干嘛|去哪|做什么)|有空|有时间/.test(text);
        if (isVagueTripIntent && !isPlanMode && !forcePlan) {
          appendMessages((prev) => [
            ...prev,
            {
              id: genId + '_req',
              type: 'assistant',
              content: '',
              requirementQuery: `请规划一条出行路线：${text}`,
            },
          ]);
          setQuery('');
          planningInProgressRef.current = false;
          return;
        }
        setQuery('');
        setIsPlanMode(false);
        try {
          const city = await getUserCity();
          const aiReply = await chatInHome(text, {
            city,
            profiles: selectedProfiles.length > 0 ? selectedProfiles : combinedProfiles,
            recentPlans: savedPlans.slice(0, 3),
            currentHour: new Date().getHours(),
          });
          if (stopIfSessionChanged()) return;
          appendMessages((prev) => [
            ...prev,
            { id: genId + '_chat', type: 'assistant', content: aiReply.text },
          ]);
          if (aiReply.suggestedPrompts && aiReply.suggestedPrompts.length > 0) {
            appendMessages((prev) => [
              ...prev,
              {
                id: genId + '_suggest',
                type: 'assistant',
                content: '',
                suggestedPrompts: aiReply.suggestedPrompts,
              },
            ]);
          }
        } catch {
          if (stopIfSessionChanged()) return;
          appendMessages((prev) => [
            ...prev,
            {
              id: genId + '_chat_err',
              type: 'assistant',
              content: '有什么我能帮你的吗？我可以帮你找餐厅、查天气，或者规划出行路线。',
            },
          ]);
        }
        planningInProgressRef.current = false;
        return;
      }

      // ── 需求澄清（智能追问）──
      if (intent.type === 'plan' && !isPlanMode && !forcePlan) {
        const parsed = parseInputForRequirements(text);
        // 阈值 0.6：5/8 = 0.625，"周六带女朋友出去玩"只有 date+people = 0.25，会触发追问
        if (parsed.completeness < 0.6) {
          // 传递解析结果给追问卡片，用于智能预填
          appendMessages((prev) => [
            ...prev,
            {
              id: genId + '_req',
              type: 'assistant',
              content: '',
              requirementQuery: text,
              parsedRequirements: parsed,
            },
          ]);
          setQuery('');
          planningInProgressRef.current = false;
          return;
        }
      }

      // ── 行程生成（Plan 意图） ──
      const pipelineId = genId + '_pipe';
      appendMessages((prev) => [
        ...prev,
        {
          id: pipelineId,
          type: 'pipeline',
          pipelineTitle: '正在为你规划行程...',
          pipelineSteps: [
            { id: 's0', title: '读取个人偏好', icon: null, status: 'running' },
            { id: 's1', title: '分析意图与偏好', icon: null, status: 'pending' },
            { id: 's2', title: '获取实时天气', icon: null, status: 'pending' },
            { id: 's3', title: '搜索热门目的地', icon: null, status: 'pending' },
            { id: 's4', title: '推算排队时长', icon: null, status: 'pending' },
            { id: 's5', title: '生成行程方案', icon: null, status: 'pending' },
          ],
          pipelineCollapsed: false,
        },
      ]);
      setQuery('');
      setIsPlanMode(false);

      const updateStep = (stepId: string, status: 'running' | 'done', summary?: string) => {
        if (!isSessionCurrent()) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== pipelineId) return m;
            const nextSteps = m.pipelineSteps?.map((s) =>
              s.id === stepId
                ? { ...s, status, summary }
                : s.id > stepId
                  ? s
                  : { ...s, status: 'done' as const }
            );
            const doneSteps = nextSteps?.filter((step) => step.status === 'done') || [];
            return {
              ...m,
              pipelineSteps: nextSteps,
              pipelineSummary: doneSteps[doneSteps.length - 1]?.summary || m.pipelineSummary,
            } as ChatMessage;
          })
        );
      };

      try {
        // 读取个人偏好
        try {
          const { getUserPreferences } = await import('../services/userPreference');
          const prefs = await getUserPreferences();
          if (!isSessionCurrent()) return;
          if (
            prefs &&
            (prefs.favoriteCategories.length > 0 || prefs.dietaryRestrictions.length > 0)
          ) {
            const parts: string[] = [];
            if (prefs.favoriteCategories.length > 0)
              parts.push(`偏好: ${prefs.favoriteCategories.slice(0, 3).join('、')}`);
            if (prefs.dietaryRestrictions.length > 0)
              parts.push(`忌口: ${prefs.dietaryRestrictions.join('、')}`);
            updateStep('s0', 'done', parts.join('，'));
          } else {
            updateStep('s0', 'done', '暂无历史偏好，将根据你的需求智能推荐');
          }
        } catch {
          updateStep('s0', 'done', '偏好读取中，将根据你的需求推荐');
        }

        const intentResult = analyzeIntentFromProfiles(
          text,
          selectedProfiles.length > 0 ? selectedProfiles : combinedProfiles
        );
        updateStep('s1', 'done', `${intentResult}。${collabSummary.analysisText}`);

        let weatherDataForPlan:
          | { city: string; temp: number; condition: string; advice: string }
          | undefined;
        let resolvedCity = '未知';
        try {
          resolvedCity = await getUserCity();
          const weather = await fetchWeather(resolvedCity);
          if (!isSessionCurrent()) return;
          weatherDataForPlan = weather;
          updateStep(
            's2',
            'done',
            `${weather.city} ${weather.temp}°C ${weather.condition}，${weather.advice}`
          );
        } catch {
          weatherDataForPlan = {
            city: resolvedCity,
            temp: 22,
            condition: '晴',
            advice: '天气数据暂时不可用',
          };
          updateStep('s2', 'done', '天气数据获取中，已使用默认建议');
        }

        const interests = combinedProfiles
          .filter((p) => selectedProfileIds.has(p.id))
          .flatMap((p) => p.travelPreferences);
        const searchResult = await searchDestinations(interests, text);
        if (!isSessionCurrent()) return;
        updateStep(
          's3',
          'done',
          `已检索 ${searchResult.count} 个目的地，筛选出 ${searchResult.topRated.length} 个高评分选项`
        );

        const hour = new Date().getHours();
        const isPeak = (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 19);
        updateStep(
          's4',
          'done',
          isPeak ? '当前处于用餐高峰，部分餐厅可能排队 15-30 分钟' : '当前时段较为宽松'
        );

        updateStep('s5', 'running');
        const dna = generateTravelDNA(savedPlans, plannerTaskStates, taskSessions, profiles);
        const planningContext: PlanningContext = {
          profiles: selectedProfiles.length > 0 ? selectedProfiles : combinedProfiles,
          weather: weatherDataForPlan,
          collaboration:
            selectedProfiles.length > 1
              ? {
                  strategyLabel: collabSummary.strategyLabel,
                  consensus: collabSummary.consensus,
                  conflicts: collabSummary.conflicts,
                  topAvoids: collabSummary.topAvoids,
                  tieBreakerLabel: collabSummary.tieBreakerLabel,
                }
              : undefined,
          memberCount: selectedProfiles.length || combinedProfiles.length || 1,
          timePref: undefined,
        };
        const generatedPlan = await generatePlan(
          constructedQuery,
          weatherDataForPlan?.city,
          AbortSignal.timeout(60000),
          dna,
          planningContext,
          sessionSnapshot
        );
        if (!isSessionCurrent()) return;
        const enrichedPlan: Plan = {
          ...generatedPlan,
          id: generatedPlan.id || `dyn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          memberCount: extractPeopleCountFromText(text) ?? (selectedProfiles.length || 1),
          executionReadiness: buildExecutionReadiness(
            generatedPlan,
            weatherDataForPlan,
            collabSummary.strategyLabel
          ),
          ...(selectedProfiles.length > 1
            ? {
                collaboration: {
                  strategyLabel: collabSummary.strategyLabel,
                  members: collabSummary.memberSummaries,
                  consensus: collabSummary.consensus,
                  conflicts: collabSummary.conflicts,
                  tieBreaker: collabSummary.tieBreakerLabel,
                },
              }
            : {}),
        };
        onSavePlan(enrichedPlan);
        if (!isSessionCurrent()) return;
        persistActiveSession(
          {
            title: text.length > 18 ? `${text.slice(0, 18)}...` : text || enrichedPlan.title,
            summary: enrichedPlan.summary,
            status: 'ready',
            planId: enrichedPlan.id,
            planTitle: enrichedPlan.title,
            planSummary: enrichedPlan.summary,
            durationTags: enrichedPlan.durationTags,
            totalPrice: enrichedPlan.totalPrice,
            memberCount: extractPeopleCountFromText(text) ?? (selectedProfiles.length || 1),
          },
          sessionSnapshot
        );
        updateStep(
          's5',
          'done',
          `已生成 ${enrichedPlan.activities.length} 个活动点，总预算 ¥${enrichedPlan.totalPrice}`
        );
        if (!isSessionCurrent()) return;
        setMessages((prev) => [
          ...prev.map((m) =>
            m.id === pipelineId
              ? {
                  ...m,
                  pipelineTitle: '分析完成',
                  pipelineSummary: `已生成 ${enrichedPlan.activities.length} 个活动点`,
                  pipelineCollapsed: true,
                }
              : m
          ),
          { id: genId + '_plan', type: 'plan', plan: enrichedPlan, content: enrichedPlan.summary },
        ]);
      } catch (err) {
        if (!isSessionCurrent()) return;
        console.error('[useHomeChat] Plan generation failed:', err);
        const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
        const msg = isTimeout
          ? '规划请求超时，服务器可能繁忙，请稍后重试。'
          : '抱歉，规划线路时遇到了网络问题，请重试。';
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== pipelineId),
          { id: (Date.now() + 2).toString(), type: 'assistant', content: msg },
        ]);
      } finally {
        planningInProgressRef.current = false;
      }
    },
    [
      query,
      isPlanMode,
      getCollabData,
      savedPlans,
      appendMessages,
      setMessages,
      setQuery,
      setIsPlanMode,
      onSavePlan,
      persistActiveSession,
    ]
  );

  const handleGuideImport = useCallback(() => {
    const cleaned = guideText.trim();
    if (!cleaned) return;
    const shortened = cleaned.replace(/\s+/g, ' ').slice(0, 900);
    setShowImportGuide(false);
    setGuideText('');
    handleStartPlan(
      `根据这段攻略内容帮我提取值得去的地点，去重后规划一条顺路、可预订的半日行程：${shortened}`
    );
  }, [guideText, handleStartPlan]);

  // ── 建议卡片（三层推荐引擎） ──
  const suggestionCards = useMemo(() => {
    return recommendCards({
      profiles,
      savedPlans,
      plannerTaskStates,
      taskSessions,
      activeSessionPlan,
      weather: null,
      recentTopicKeys: params.recentCardKeys || [],
    });
  }, [
    profiles,
    savedPlans,
    plannerTaskStates,
    taskSessions,
    activeSessionPlan,
    params.recentCardKeys,
  ]);

  return {
    messages,
    setMessages,
    query,
    setQuery,
    isRecording,
    setIsRecording,
    planningInProgressRef,
    appendMessages,
    handleUpdateWeatherMessage,
    handleStartPlan,
    handleGuideImport,
    showImportGuide,
    setShowImportGuide,
    showAttachMenu,
    setShowAttachMenu,
    guideText,
    setGuideText,
    suggestionCards,
    scrollRef,
  };
}
