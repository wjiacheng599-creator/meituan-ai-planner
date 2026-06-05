/**
 * Collaborate — 多用户协作投票页面 v2
 *
 * 改进：
 * - 自动识别用户身份（profiles 替代手动输入）
 * - 活动级投票（每个活动独立赞成/反对/建议）
 * - 精细化共识算法（加权投票 + 动态阈值）
 * - 投票 → AI 重新规划闭环
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Users,
  CheckCircle2,
  Loader2,
  Send,
  Copy,
  Check,
  Sparkles,
  GitMerge,
  Wand2,
} from 'lucide-react';
import type { Plan, Activity } from '../../services/ai';
import type { PersonProfile } from '../../types';
import { copyText } from '../../services/clientActions';
import { getAvatarPath } from '../../utils/avatarUtils';
import { useBehaviorTracking } from '../../hooks/useBehaviorTracking';

// ── 类型定义 ──

interface ActivityVote {
  activityId: string;
  voterName: string;
  voterAvatar?: string;
  vote: 'approve' | 'reject' | 'suggest';
  suggestion?: string;
  weight: number; // 发起人 1.5，普通 1.0
  createdAt: number;
}

interface ActivityVoteStats {
  activityId: string;
  activityTitle: string;
  approve: number;
  reject: number;
  suggest: number;
  weightedApproveRate: number;
  isControversial: boolean; // 反对率 ≥ 50%
  suggestions: Array<{ voterName: string; suggestion: string }>;
}

interface CollaborateProps {
  plan: Plan | null;
  profiles?: PersonProfile[];
  shareSlug?: string;
  onBack: () => void;
  onPlanUpdated?: (updatedPlan: Plan) => void;
}

// ── 共识算法 ──

function getDynamicThreshold(voterCount: number): number {
  if (voterCount <= 1) return 1.0;
  if (voterCount === 2) return 1.0; // 2人必须全票
  if (voterCount === 3) return 0.67; // 3人需要 2/3
  return 0.6; // 4人+ 需要 60%
}

function computeActivityStats(votes: ActivityVote[], activity: Activity): ActivityVoteStats {
  const actVotes = votes.filter((v) => v.activityId === activity.id);
  const approve = actVotes.filter((v) => v.vote === 'approve').length;
  const reject = actVotes.filter((v) => v.vote === 'reject').length;
  const suggest = actVotes.filter((v) => v.vote === 'suggest').length;
  const totalWeight = actVotes.reduce((s, v) => s + v.weight, 0);
  const weightedApprove = actVotes
    .filter((v) => v.vote === 'approve')
    .reduce((s, v) => s + v.weight, 0);

  return {
    activityId: activity.id,
    activityTitle: activity.title,
    approve,
    reject,
    suggest,
    weightedApproveRate: totalWeight > 0 ? weightedApprove / totalWeight : 0,
    isControversial: actVotes.length > 0 && reject / actVotes.length >= 0.5,
    suggestions: actVotes
      .filter((v) => v.suggestion)
      .map((v) => ({ voterName: v.voterName, suggestion: v.suggestion! })),
  };
}

// ── 组件 ──

export default function Collaborate({
  plan,
  profiles = [],
  shareSlug,
  onBack,
  onPlanUpdated,
}: CollaborateProps) {
  // 自动识别当前用户（第一个 profile）
  const currentUser = profiles[0] || null;
  const voterName = currentUser?.name || '';
  const voterAvatar = currentUser?.avatar;
  const isInitiator = true; // TODO: 从 share 记录判断是否是发起人
  const behavior = useBehaviorTracking();

  const [activityVotes, setActivityVotes] = useState<ActivityVote[]>([]);
  const [selectedVotes, setSelectedVotes] = useState<
    Record<string, 'approve' | 'reject' | 'suggest'>
  >({});
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // 计算每个活动的投票统计
  const activityStatsMap = useMemo(() => {
    if (!plan) return {};
    const map: Record<string, ActivityVoteStats> = {};
    for (const act of plan.activities) {
      map[act.id] = computeActivityStats(activityVotes, act);
    }
    return map;
  }, [activityVotes, plan]);

  // 整体共识判断
  const totalVoters = useMemo(
    () => new Set(activityVotes.map((v) => v.voterName)).size,
    [activityVotes]
  );
  const threshold = useMemo(() => getDynamicThreshold(totalVoters), [totalVoters]);
  const overallApproveRate = useMemo(() => {
    if (!plan || activityVotes.length === 0) return 0;
    const stats = Object.values(activityStatsMap);
    return stats.reduce((s, a) => s + a.weightedApproveRate, 0) / stats.length;
  }, [activityStatsMap, plan, activityVotes]);
  const consensusReached = totalVoters >= 2 && overallApproveRate >= threshold;
  const controversialActivities = useMemo(
    () => Object.values(activityStatsMap).filter((a) => a.isControversial),
    [activityStatsMap]
  );

  // 从服务端拉取投票数据
  const fetchVotes = useCallback(async () => {
    if (!shareSlug) return;
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(shareSlug)}/votes`);
      if (res.ok) {
        const data = await res.json();
        if (data.votes?.length > 0) {
          setActivityVotes(data.votes);
        }
      }
    } catch {
      /* ignore */
    }
  }, [shareSlug]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  // 提交所有活动的投票
  const handleSubmitVotes = useCallback(async () => {
    if (!shareSlug || !voterName || !plan) return;
    setSubmitting(true);

    const weight = isInitiator ? 1.5 : 1.0;
    const votesToSubmit: ActivityVote[] = [];

    for (const act of plan.activities) {
      const voteType = selectedVotes[act.id];
      if (!voteType) continue;
      votesToSubmit.push({
        activityId: act.id,
        voterName,
        voterAvatar,
        vote: voteType,
        suggestion: voteType === 'suggest' ? suggestions[act.id]?.trim() : undefined,
        weight,
        createdAt: Date.now(),
      });
    }

    try {
      for (const v of votesToSubmit) {
        await fetch(`/api/shares/${encodeURIComponent(shareSlug)}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(v),
        });
      }
      setActivityVotes((prev) => {
        const existing = prev.filter((v) => v.voterName !== voterName);
        return [...existing, ...votesToSubmit];
      });
      setSubmitted(true);
      // Track vote behavior
      for (const v of votesToSubmit) {
        behavior.trackVote(plan?.id || '', v.vote, {
          activityId: v.activityId,
          activityTitle: plan?.activities.find((a) => a.id === v.activityId)?.title,
        });
      }
    } catch (err) {
      console.error('[Collaborate] Vote failed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [shareSlug, voterName, voterAvatar, isInitiator, plan, selectedVotes, suggestions, behavior]);

  // AI 优化有争议的活动
  const handleOptimizeControversial = useCallback(async () => {
    if (!plan || !shareSlug || controversialActivities.length === 0) return;
    setIsOptimizing(true);

    const controversialIds = new Set(controversialActivities.map((a) => a.activityId));
    const allSuggestions = controversialActivities.flatMap((a) =>
      a.suggestions.map((s) => `${a.activityTitle}: ${s.suggestion}`)
    );

    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(shareSlug)}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          controversialActivities: controversialActivities.map((a) => ({
            id: a.activityId,
            title: a.activityTitle,
            rejectRate: Math.round((1 - a.weightedApproveRate) * 100),
            suggestions: a.suggestions,
          })),
          allSuggestions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.updatedPlan) {
          onPlanUpdated?.(data.updatedPlan);
          setShowResult(true);
        }
      }
    } catch (err) {
      console.error('[Collaborate] Optimize failed:', err);
    } finally {
      setIsOptimizing(false);
    }
  }, [plan, shareSlug, controversialActivities, onPlanUpdated]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/collaborate/${shareSlug}`;
    copyText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!plan) return null;

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3 bg-[#fbfcff]/88 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="app-pill w-10 h-10 flex items-center justify-center rounded-full"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-[#141821] text-[20px] tracking-tight">协作投票</h1>
          <p className="text-[13px] text-[var(--app-text-soft)] font-medium">{plan.title}</p>
        </div>
        <button
          onClick={handleCopyLink}
          className="app-pill px-3 py-2 rounded-full flex items-center gap-1 text-[13px] font-bold text-[var(--app-text)]"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? '已复制' : '复制链接'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24 space-y-4">
        {/* 当前用户身份 */}
        {currentUser && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[var(--info-soft)] rounded-2xl border border-blue-100">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
              {voterAvatar ? (
                <img
                  src={getAvatarPath({ name: voterName, avatar: voterAvatar })}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[13px] font-bold text-[var(--info-ink)]">{voterName[0]}</span>
              )}
            </div>
            <div>
              <p className="text-[13px] font-bold text-[var(--app-ink)]">{voterName}</p>
              <p className="text-[11px] text-[var(--app-text)]">
                {currentUser.relation} · {isInitiator ? '发起人（权重 ×1.5）' : '参与者'}
              </p>
            </div>
          </div>
        )}

        {/* 共识状态 */}
        {totalVoters > 0 && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
              consensusReached
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-[var(--warning-soft)] border-amber-200'
            }`}
          >
            {consensusReached ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <Users className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <div>
              <p className="text-[13px] font-bold text-[var(--app-ink)]">
                {consensusReached ? '已达成共识！' : `投票进行中（${totalVoters} 人）`}
              </p>
              <p className="text-[11px] text-[var(--app-text)]">
                赞成率 {Math.round(overallApproveRate * 100)}% · 阈值 {Math.round(threshold * 100)}%
                {controversialActivities.length > 0 &&
                  ` · ${controversialActivities.length} 个活动有争议`}
              </p>
            </div>
          </div>
        )}

        {/* 活动级投票列表 */}
        <div className="app-card rounded-[24px] p-4">
          <h3 className="text-[13px] font-bold text-[var(--app-ink)] mb-3">逐项投票</h3>
          <div className="space-y-3">
            {plan.activities
              .filter((a) => a.type !== 'travel')
              .map((act, i) => {
                const stats = activityStatsMap[act.id];
                const myVote = selectedVotes[act.id];
                const existingVotes = activityVotes.filter((v) => v.activityId === act.id);
                const hasMyExistingVote = existingVotes.some((v) => v.voterName === voterName);

                return (
                  <div
                    key={act.id}
                    className={`rounded-2xl border p-3.5 transition-all ${
                      stats?.isControversial
                        ? 'border-rose-200 bg-rose-50/50'
                        : 'border-[var(--app-border)] bg-white'
                    }`}
                  >
                    {/* 活动信息 */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--app-card-soft)] flex items-center justify-center text-[10px] font-bold text-[var(--app-text)] shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[var(--app-ink)]">{act.title}</p>
                        <p className="text-[11px] text-[var(--app-text-soft)]">
                          {act.timeLine} · ¥{act.price}
                        </p>
                      </div>
                      {/* 已有投票统计 */}
                      {existingVotes.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold shrink-0">
                          {stats.approve > 0 && (
                            <span className="text-emerald-600">👍{stats.approve}</span>
                          )}
                          {stats.reject > 0 && (
                            <span className="text-rose-600">👎{stats.reject}</span>
                          )}
                          {stats.suggest > 0 && (
                            <span className="text-[var(--warning-ink)]">💬{stats.suggest}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 已有建议 */}
                    {stats?.suggestions && stats.suggestions.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {stats.suggestions.map((s, si) => (
                          <div
                            key={si}
                            className="flex gap-1.5 px-2.5 py-1.5 bg-[var(--warning-soft)] rounded-lg"
                          >
                            <span className="text-[10px] font-bold text-amber-700">
                              {s.voterName}：
                            </span>
                            <span className="text-[10px] text-[var(--app-text)]">
                              {s.suggestion}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 投票按钮（未投票时显示） */}
                    {!hasMyExistingVote && !submitted && (
                      <>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['approve', 'reject', 'suggest'] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() =>
                                setSelectedVotes((prev) => ({ ...prev, [act.id]: type }))
                              }
                              className={`flex items-center justify-center gap-1 py-2 rounded-xl border-2 text-[11px] font-bold transition-all ${
                                myVote === type
                                  ? type === 'approve'
                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                    : type === 'reject'
                                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                                      : 'border-amber-400 bg-[var(--warning-soft)] text-amber-700'
                                  : 'border-[var(--app-border)] text-[var(--app-text)] hover:border-[var(--app-border)]'
                              }`}
                            >
                              {type === 'approve'
                                ? '👍 赞成'
                                : type === 'reject'
                                  ? '👎 反对'
                                  : '💬 建议'}
                            </button>
                          ))}
                        </div>
                        {myVote === 'suggest' && (
                          <textarea
                            value={suggestions[act.id] || ''}
                            onChange={(e) =>
                              setSuggestions((prev) => ({ ...prev, [act.id]: e.target.value }))
                            }
                            placeholder="写下你的建议..."
                            className="mt-2 w-full h-14 px-3 py-2 rounded-xl border border-[var(--app-border)] text-[13px] resize-none outline-none focus:border-gray-400"
                          />
                        )}
                      </>
                    )}

                    {/* 已投票标记 */}
                    {(hasMyExistingVote || submitted) && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        已投票
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* 提交按钮 */}
        {!submitted && (
          <button
            onClick={handleSubmitVotes}
            disabled={Object.keys(selectedVotes).length === 0 || submitting}
            className="w-full app-btn-primary py-3.5 rounded-2xl text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 提交中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> 提交投票（{Object.keys(selectedVotes).length} 项）
              </>
            )}
          </button>
        )}

        {/* 投票完成 + AI 优化 */}
        {submitted && (
          <div className="space-y-3">
            <div className="app-card rounded-[24px] p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-[15px] font-bold text-[var(--app-ink)] mb-1">投票已提交</p>
              <p className="text-[13px] text-[var(--app-text-soft)]">等待其他成员投票...</p>
            </div>

            {/* AI 优化有争议的活动 */}
            {consensusReached && controversialActivities.length > 0 && (
              <button
                onClick={handleOptimizeControversial}
                disabled={isOptimizing}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> AI 正在优化...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" /> AI 优化 {controversialActivities.length}{' '}
                    个争议活动
                  </>
                )}
              </button>
            )}

            {/* 全票通过 */}
            {consensusReached && controversialActivities.length === 0 && (
              <div className="app-card rounded-[24px] p-4 bg-emerald-50 border border-emerald-200 text-center">
                <Sparkles className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-[13px] font-bold text-emerald-800">全票通过！可以出发了 🎉</p>
              </div>
            )}

            <button
              onClick={() => {
                setSubmitted(false);
                setSelectedVotes({});
                setSuggestions({});
              }}
              className="w-full text-[13px] font-bold text-[var(--app-text)] hover:text-[var(--app-ink)] py-2"
            >
              重新投票
            </button>
          </div>
        )}

        {/* AI 优化结果 */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="app-card rounded-[24px] p-4 bg-purple-50 border border-purple-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                <span className="text-[13px] font-bold text-purple-800">行程已优化</span>
              </div>
              <p className="text-[13px] text-purple-700">
                有争议的活动已根据团队建议替换，行程已更新。
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
