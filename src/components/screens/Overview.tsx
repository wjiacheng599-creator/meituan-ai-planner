import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import type { Plan, Activity, WeatherInfo } from '../../services/ai';
import { fetchWeather } from '../../services/ai';
import { planRoute } from '../../services/apiAdapter';
import { useTravelMode } from '../../hooks/useTravelMode';
import {
  ChevronLeft,
  Clock,
  MapPin,
  Coffee,
  Utensils,
  Heart,
  Lightbulb,
  Users,
  Car,
  Salad,
  Ticket,
  CloudSun,
  DollarSign,
  Sparkles,
  CheckCircle2,
  CircleAlert,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import type { RouteSegment } from '../../types';
import { RouteSegmentTimeline } from '../ui/RouteSegmentTimeline';

interface OverviewProps {
  plan: Plan | null;
  onConfirm?: () => void;
  onShare?: () => void;
  onViewDetails?: (activity: Activity) => void;
  onBack: () => void;
  peopleCount?: number;
}

const activityIcons: Record<string, React.ReactNode> = {
  出行: <Car className="w-4 h-4 text-[var(--sky-ink)]" />,
  茶歇: <Coffee className="w-4 h-4 text-[var(--peach-ink)]" />,
  美食: <Salad className="w-4 h-4 text-[var(--peach-ink)]" />,
  活动: <Ticket className="w-4 h-4 text-[var(--mint-ink)]" />,
  默认: <MapPin className="w-4 h-4 text-[var(--sky-ink)]" />,
};

function getActivityIcon(act: Activity) {
  if (act.type === 'travel') return activityIcons['出行'];
  if (act.type === 'food' && act.title.includes('茶')) return activityIcons['茶歇'];
  if (act.type === 'food') return activityIcons['美食'];
  if (act.type === 'activity') return activityIcons['活动'];
  return activityIcons['默认'];
}

function getActivityNodeClasses(act: Activity) {
  if (act.type === 'food') {
    return 'bg-[var(--peach-soft)] border-[var(--peach-strong)] shadow-[0_8px_18px_rgba(217,139,76,0.12)]';
  }

  if (act.type === 'activity') {
    return 'bg-[var(--mint-soft)] border-[var(--mint-strong)] shadow-[0_8px_18px_rgba(42,162,122,0.12)]';
  }

  return 'bg-[var(--sky-soft)] border-[var(--sky-strong)] shadow-[0_8px_18px_rgba(107,125,152,0.12)]';
}

export default function Overview({
  plan,
  onConfirm,
  onShare,
  onViewDetails,
  onBack,
  peopleCount = 1,
}: OverviewProps) {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [selectedBudgetIdx, setSelectedBudgetIdx] = useState(1); // 默认选中标准版
  const { travelMode } = useTravelMode();

  // 计算当前预算版本的价格和活动
  // 如果 LLM 没有输出 budgetOptions，则根据主行程自动生成 3 个版本
  const baseTotal = plan?.totalPrice || 0;
  const budgetOptions = (() => {
    const pc = Math.max(1, peopleCount);
    const raw = plan?.budgetOptions?.length
      ? plan.budgetOptions
      : [
          {
            label: '经济版',
            perPerson: Math.round((baseTotal * 0.6) / pc),
            total: Math.round(baseTotal * 0.6),
            strategy: '选择性价比最高的场所，节省 30-40%',
          },
          {
            label: '标准版',
            perPerson: Math.round(baseTotal / pc),
            total: baseTotal,
            strategy: '平衡体验和价格，推荐方案',
          },
          {
            label: '品质版',
            perPerson: Math.round((baseTotal * 1.6) / pc),
            total: Math.round(baseTotal * 1.6),
            strategy: '优先体验和品质，高端场所',
          },
        ];
    const prices = raw.map((o) => o.perPerson);
    if (prices.every((p) => p === prices[0]) && prices[0] > 0) {
      const base = prices[0];
      return raw.map((o, i) => ({
        ...o,
        perPerson: i === 0 ? Math.round(base * 0.7) : i === 1 ? base : Math.round(base * 1.5),
        total:
          i === 0 ? Math.round(base * 0.7 * pc) : i === 1 ? base * pc : Math.round(base * 1.5 * pc),
      }));
    }
    return raw;
  })();
  const currentBudget = budgetOptions[selectedBudgetIdx] || budgetOptions[1] || budgetOptions[0];
  const displayTotal = currentBudget?.total || baseTotal;
  const displayPerPerson =
    currentBudget?.perPerson || Math.round(displayTotal / Math.max(1, peopleCount));
  // 当前展示的活动列表（如果有预算版本的活动则使用，否则使用主活动）
  const displayActivities = currentBudget?.activities || plan?.activities || [];

  useEffect(() => {
    const ac = new AbortController();
    fetchWeather(plan?.city).then((data) => {
      if (!ac.signal.aborted) setWeather(data);
    });
    return () => {
      ac.abort();
    };
  }, [plan?.city]);

  useEffect(() => {
    if (!plan || plan.activities.length < 2) {
      setRouteSegments([]);
      return;
    }

    const ac = new AbortController();
    const { signal } = ac;
    setIsRouteLoading(true);

    (async () => {
      try {
        const nonTravelActivities = plan.activities.filter((a) => a.type !== 'travel');
        if (nonTravelActivities.length < 2) {
          if (!signal.aborted) setRouteSegments([]);
          return;
        }

        const rawSegments = await Promise.all(
          nonTravelActivities.slice(0, -1).map(async (activity, i) => {
            const nextActivity = nonTravelActivities[i + 1];
            try {
              const result = await planRoute(
                { lat: activity.lat || 0, lng: activity.lng || 0, name: activity.title },
                {
                  lat: nextActivity.lat || 0,
                  lng: nextActivity.lng || 0,
                  name: nextActivity.title,
                },
                travelMode
              );
              if (signal.aborted || !result) return null;
              return {
                from: { name: activity.title, lat: activity.lat || 0, lng: activity.lng || 0 },
                to: {
                  name: nextActivity.title,
                  lat: nextActivity.lat || 0,
                  lng: nextActivity.lng || 0,
                },
                mode: travelMode,
                distance: result.distance,
                duration: result.duration,
                polyline: result.polyline,
              };
            } catch {
              return null;
            }
          })
        );

        if (!signal.aborted) {
          setRouteSegments(rawSegments.filter((s) => s !== null) as unknown as RouteSegment[]);
        }
      } finally {
        if (!signal.aborted) setIsRouteLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [plan, travelMode]);

  if (!plan) return null;

  const collaborationMembers = plan.collaboration?.members || [];
  const readiness = plan.executionReadiness;

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="px-5 pt-14 pb-2 bg-white/72 backdrop-blur-xl sticky top-0 z-10 flex items-center border-b border-[var(--app-border)]/80">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronLeft className="w-7 h-7 text-[var(--app-ink)]" />
        </button>
        <span className="flex-1 text-center font-bold text-[#141821] text-[18px]">方案确认</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-transparent pb-28 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="px-5">
            <div className="relative mb-8 w-full aspect-[4/5] max-h-[460px] overflow-hidden rounded-[24px] shadow-[0_16px_42px_rgba(20,24,33,0.14)]">
              <div className="h-full w-full bg-[linear-gradient(135deg,#fff7fb_0%,#ffe7f1_34%,#fff1e1_68%,#eef2fb_100%)]"></div>
              <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div className="absolute top-5 right-5 bg-black/30 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
                <div className="flex items-center text-white text-[13px] font-bold">
                  <Clock className="w-4 h-4 mr-1.5" />
                  <span>{plan.durationTags || '约5.5小时'}</span>
                </div>
              </div>
              <div className="absolute bottom-7 left-6 right-6 text-white">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {(plan.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[11px] font-bold rounded-full border border-white/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-[28px] font-bold tracking-tight text-shadow-lg leading-tight mb-3">
                  {plan.title}
                </h3>
                <p className="text-[13px] font-bold text-white/90 leading-relaxed line-clamp-3">
                  {plan.summary}
                </p>
              </div>
            </div>

            <div className="app-card rounded-[24px] p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-[#141821] text-[18px]">行程概览</h4>
                <span className="text-[13px] font-semibold text-[#7d8695] app-card-soft px-3 py-1 rounded-full">
                  {(() => {
                    const first = plan.activities.find((a) => a.type !== 'travel');
                    const t = first?.timeLine?.split('-')[0]?.trim();
                    return t ? `今天 ${t} 出发` : '今天出发';
                  })()}
                </span>
              </div>

              {plan.collaboration && plan.collaboration.members.length > 1 && (
                <div className="mb-5 rounded-[24px] border border-[var(--rose-strong)] bg-[linear-gradient(135deg,#fff7fb_0%,#ffe7f1_48%,#fff1e1_100%)] p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-[var(--rose-ink)]" />
                        <span className="text-[13px] font-bold text-[var(--rose-ink)]">
                          同行确认
                        </span>
                      </div>
                      <p className="text-[11px] font-bold leading-relaxed text-[#7d4b3e]">
                        {plan.collaboration.strategyLabel} ·{' '}
                        {plan.collaboration.consensus.join('、')}
                      </p>
                    </div>
                    {onShare && (
                      <button
                        onClick={onShare}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full app-pill px-3 py-2 text-[11px] font-bold text-[#141821] active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        发给同行人
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {collaborationMembers.map((member) => (
                      <span
                        key={member.id}
                        className="rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[var(--app-ink)]"
                      >
                        {member.name}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {plan.collaboration.consensus.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--rose-ink)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  {plan.collaboration.conflicts.length > 0 && (
                    <p className="text-[11px] font-bold leading-relaxed text-[#7d4b3e]">
                      已协调：{plan.collaboration.conflicts.join('；')}
                    </p>
                  )}
                  {plan.collaboration.tieBreaker && (
                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#7d4b3e]">
                      裁决优先：{plan.collaboration.tieBreaker}
                    </p>
                  )}
                </div>
              )}

              {plan.collaboration && plan.collaboration.members.length > 1 && (
                <div className="mb-5 rounded-[24px] border border-[var(--app-border)] bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[var(--rose-ink)]" />
                    <span className="text-[13px] font-bold text-[var(--app-ink)]">
                      这条路线怎么平衡大家
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {plan.collaboration.members.map((member) => (
                      <div key={member.id} className="rounded-2xl app-card-soft px-3.5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[13px] font-bold text-[var(--app-ink)]">
                            {member.name}
                          </div>
                          <div className="text-[10px] font-bold text-[var(--app-text-soft)]">
                            {member.relation}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                          想要：
                          {member.votes.length > 0 ? member.votes.join('、') : '已纳入整体安排'}
                        </div>
                        {member.avoids && member.avoids.length > 0 && (
                          <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                            已避开：{member.avoids.join('、')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {plan.collaboration.conflicts.length > 0 && (
                    <div className="mt-3 rounded-2xl bg-[linear-gradient(135deg,#fff7fb_0%,#ffe7f1_60%,#fff1e1_100%)] px-3.5 py-3">
                      <div className="text-[11px] font-bold text-[var(--rose-ink)]">
                        冲突平衡结果
                      </div>
                      <div className="mt-1 text-[11px] font-bold leading-relaxed text-[#7d4b3e]">
                        {plan.collaboration.conflicts.join('；')}。最终按“
                        {plan.collaboration.tieBreaker || plan.collaboration.strategyLabel}
                        ”保留了更适合整体出行的节奏。
                      </div>
                    </div>
                  )}
                </div>
              )}

              {readiness && (
                <div
                  className={`mb-5 rounded-[24px] p-4 border ${
                    readiness.status === 'ready'
                      ? 'bg-[var(--success-soft)] border-[#cfe9d8]'
                      : readiness.status === 'adjust'
                        ? 'bg-[var(--peach-soft)] border-[var(--peach-strong)]'
                        : 'bg-[var(--danger-soft)] border-[#ffd6dd]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {readiness.status === 'ready' ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--mint-ink)]" />
                    ) : readiness.status === 'adjust' ? (
                      <CircleAlert className="w-4 h-4 text-[var(--peach-ink)]" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-[var(--danger-ink)]" />
                    )}
                    <span className="text-[13px] font-bold text-[var(--app-ink)]">执行前检查</span>
                  </div>
                  <p className="text-[11px] font-bold text-[var(--app-text)] leading-relaxed mb-3">
                    {readiness.summary}
                  </p>
                  <div className="space-y-2">
                    {readiness.checks.map((check) => (
                      <div key={check.label} className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 w-2 h-2 rounded-full ${
                            check.status === 'ok'
                              ? 'bg-[var(--mint-ink)]'
                              : check.status === 'warning'
                                ? 'bg-[var(--peach-ink)]'
                                : 'bg-[var(--danger-ink)]'
                          }`}
                        ></span>
                        <div>
                          <div className="text-[11px] font-bold text-[var(--app-ink)]">
                            {check.label}
                          </div>
                          <div className="text-[10px] font-bold text-[var(--app-text)]">
                            {check.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {readiness.fallbackOptions && readiness.fallbackOptions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/60">
                      <div className="text-[11px] font-bold text-[var(--app-ink)] mb-2">
                        可切换方案
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {readiness.fallbackOptions.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold text-[var(--app-ink)] border border-white active:scale-95"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {plan.strategy && (
                <div className="mb-5 rounded-[24px] border border-[var(--sky-strong)] bg-[linear-gradient(135deg,var(--sky-soft)_0%,#f8fbff_60%,#fff6eb_100%)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-[var(--sky-ink)]" />
                    <span className="text-[13px] font-bold text-[var(--sky-ink)]">AI 规划策略</span>
                  </div>
                  <p className="text-[13px] font-bold leading-relaxed text-[#62748d]">
                    {plan.strategy}
                  </p>
                  {plan.conflictResolution && (
                    <div className="mt-2 flex items-start gap-2 border-t border-white/70 pt-2">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--brand-ink)]" />
                      <p className="text-[11px] font-bold leading-relaxed text-[#8d6a1a]">
                        {plan.conflictResolution}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Activity timeline — horizontal scroll to handle any number of activities */}
              {currentBudget?.activities && currentBudget.activities.length > 0 && (
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span className="text-[11px] font-bold text-[var(--app-ink)]">
                    {currentBudget.label}行程
                  </span>
                  <span className="text-[10px] font-bold text-[var(--app-text-soft)]">·</span>
                  <span className="text-[10px] font-bold text-[var(--peach-ink)]">
                    ¥{displayTotal}
                  </span>
                </div>
              )}
              <div className="relative mb-8 -mx-2">
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-start px-2 gap-0" style={{ minWidth: 'max-content' }}>
                    {/* Connecting dashed line sits behind nodes */}
                    {/* Start node */}
                    <div className="flex flex-col items-center w-[64px] shrink-0">
                      <div className="w-10 h-10 bg-[var(--app-card-soft)] rounded-full flex items-center justify-center mb-2 shadow-inner border border-[var(--app-border)]">
                        <Car className="w-4 h-4 text-[var(--app-text)]" />
                      </div>
                      <span className="text-[11px] font-bold text-[var(--app-ink)]">
                        {(() => {
                          const firstNonTravel = plan.activities.find((a) => a.type !== 'travel');
                          if (firstNonTravel?.timeLine) {
                            const t = firstNonTravel.timeLine.split('-')[0]?.trim();
                            // compute rough departure time: subtract 30min
                            const match = t?.match(/^(\d{1,2}):(\d{2})$/);
                            if (match) {
                              const total = parseInt(match[1]) * 60 + parseInt(match[2]) - 30;
                              const h = Math.max(0, Math.floor(total / 60))
                                .toString()
                                .padStart(2, '0');
                              const m = (total % 60).toString().padStart(2, '0');
                              return `${h}:${m}`;
                            }
                          }
                          return '出发';
                        })()}
                      </span>
                      <span className="text-[11px] text-[var(--app-text)] mt-0.5">出发</span>
                    </div>

                    {displayActivities.map((act, i) => {
                      if (act.type === 'travel') return null;
                      const startTime = act.timeLine?.split('-')[0]?.trim() ?? '--';
                      return (
                        <React.Fragment key={act.id || `act-${i}`}>
                          {/* Dashed connector */}
                          <div className="flex items-center self-start mt-5 w-6 shrink-0">
                            <div className="w-full border-t-2 border-dashed border-[var(--app-border)]" />
                          </div>
                          <div className="flex flex-col items-center w-[64px] shrink-0">
                            <div
                              className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white ${getActivityNodeClasses(act)}`}
                            >
                              {getActivityIcon(act)}
                            </div>
                            <span className="text-[11px] font-bold text-[var(--app-ink)]">
                              {startTime}
                            </span>
                            <span className="text-[10px] text-[var(--app-text)] mt-0.5 w-[60px] text-center line-clamp-2 leading-tight">
                              {act.title}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* Dashed connector before return */}
                    <div className="flex items-center self-start mt-5 w-6 shrink-0">
                      <div className="w-full border-t-2 border-dashed border-[var(--app-border)]" />
                    </div>

                    {/* Return node */}
                    <div className="flex flex-col items-center w-[64px] shrink-0">
                      <div className="w-10 h-10 bg-[var(--app-card-soft)] rounded-full flex items-center justify-center mb-2 shadow-inner border border-[var(--app-border)]">
                        <Car className="w-4 h-4 text-[var(--app-text)]" />
                      </div>
                      <span className="text-[11px] font-bold text-[var(--app-ink)]">
                        {(() => {
                          const lastNonTravel = [...displayActivities]
                            .reverse()
                            .find((a) => a.type !== 'travel');
                          if (lastNonTravel?.timeLine) {
                            const t =
                              lastNonTravel.timeLine.split('-')[1]?.trim() ??
                              lastNonTravel.timeLine.split('-')[0]?.trim();
                            const match = t?.match(/^(\d{1,2}):(\d{2})$/);
                            if (match) {
                              const total = parseInt(match[1]) * 60 + parseInt(match[2]) + 30;
                              const h = Math.min(23, Math.floor(total / 60))
                                .toString()
                                .padStart(2, '0');
                              const m = (total % 60).toString().padStart(2, '0');
                              return `${h}:${m}`;
                            }
                          }
                          return '返回';
                        })()}
                      </span>
                      <span className="text-[11px] text-[var(--app-text)] mt-0.5">返回</span>
                    </div>
                  </div>
                </div>
                {/* Fade hint on right edge to signal scrollability when overflowing */}
                <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white/70 to-transparent" />
              </div>

              {routeSegments.length > 0 && (
                <div className="mb-5">
                  <div className="text-[13px] font-bold text-[var(--app-ink)] mb-3">路段信息</div>
                  <RouteSegmentTimeline segments={routeSegments} />
                </div>
              )}

              {/* AI Widgets */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-2xl border border-[var(--sky-strong)] bg-[linear-gradient(180deg,#f8fbff_0%,#f2f5fb_100%)] p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CloudSun className="w-4 h-4 text-[var(--sky-ink)]" />
                    <span className="text-[13px] font-bold text-[var(--sky-ink)]">目的地天气</span>
                  </div>
                  <div className="mb-1 text-[20px] font-bold text-[var(--app-ink)]">
                    {weather ? `${weather.temp}°C` : '...'}
                  </div>
                  <div className="text-[10px] font-bold text-[var(--sky-ink)]/80">
                    {weather?.advice || '加载中...'}
                  </div>
                  {weather && (
                    <div className="mt-0.5 text-[10px] text-[var(--sky-ink)]/55">
                      {weather.condition} · 湿度 {weather.humidity}%
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--peach-strong)] bg-[linear-gradient(180deg,#fff9f1_0%,#fff4e4_100%)] p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <DollarSign className="w-4 h-4 text-[var(--peach-ink)]" />
                    <span className="text-[13px] font-bold text-[var(--peach-ink)]">预估花费</span>
                  </div>
                  <div className="mb-1 text-[20px] font-bold text-[var(--app-ink)]">
                    <span className="text-[13px] mr-0.5">¥</span>
                    {displayTotal}
                  </div>
                  <div className="text-[10px] font-bold text-[var(--peach-ink)]/80">
                    人均约 ¥{displayPerPerson}
                  </div>
                  {/* 预算版本切换 */}
                  {budgetOptions.length > 0 && (
                    <div className="mt-3">
                      <div className="flex gap-1.5">
                        {budgetOptions.map((opt, idx) => {
                          const isSelected = idx === selectedBudgetIdx;
                          const isRecommended = idx === 1; // 标准版为推荐
                          const hasCustomActivities = opt.activities && opt.activities.length > 0;
                          return (
                            <button
                              key={opt.label}
                              onClick={() => setSelectedBudgetIdx(idx)}
                              className={`relative flex-1 rounded-2xl py-2.5 px-2 text-center transition-all active:scale-95 ${
                                isSelected
                                  ? 'bg-gradient-to-br from-[var(--peach-ink)] to-[var(--peach-ink)]/80 text-white shadow-lg shadow-[var(--peach-ink)]/20 scale-[1.02]'
                                  : 'bg-white/80 text-[var(--peach-ink)] border border-[var(--peach-strong)]/50 hover:border-[var(--peach-ink)]/30'
                              }`}
                            >
                              {isRecommended && (
                                <div
                                  className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold px-2 py-0.5 rounded-full ${
                                    isSelected
                                      ? 'bg-white text-[var(--peach-ink)]'
                                      : 'bg-[var(--peach-ink)] text-white'
                                  }`}
                                >
                                  推荐
                                </div>
                              )}
                              <div className="text-[11px] font-bold">{opt.label}</div>
                              <div
                                className={`text-[13px] font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-[var(--peach-ink)]'}`}
                              >
                                ¥{opt.perPerson}
                                <span className="text-[10px] font-bold opacity-70">/人</span>
                              </div>
                              {hasCustomActivities && (
                                <div
                                  className={`text-[8px] font-bold mt-0.5 ${isSelected ? 'text-white/70' : 'text-[var(--app-text-soft)]'}`}
                                >
                                  {opt.activities!.length} 个活动
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {currentBudget?.strategy && (
                        <div className="mt-2.5 text-[11px] text-[var(--peach-ink)]/70 text-center font-semibold">
                          💡 {currentBudget.strategy}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Details with Reasoning */}
              {plan.activities.some((a) => a.reasoning) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-4 h-4 text-[var(--rose-ink)]" />
                    <h5 className="font-bold text-[var(--app-ink)] text-[15px]">
                      为什么选这些地方？
                    </h5>
                  </div>
                  <div className="space-y-2.5">
                    {plan.activities
                      .filter((a) => a.type !== 'travel')
                      .map((act) => (
                        <div
                          key={act.id}
                          className="bg-[var(--app-card-soft)] rounded-2xl p-3.5 border border-[var(--app-border)]/50"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span>{getActivityIcon(act)}</span>
                            <span className="text-[13px] font-bold text-[var(--app-ink)]">
                              {act.title}
                            </span>
                          </div>
                          {act.reasoning && (
                            <p className="text-[11px] text-[var(--app-text)] font-bold leading-relaxed pl-6">
                              {act.reasoning}
                            </p>
                          )}
                          {act.teamFit && (
                            <div className="mt-1.5 pl-6">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mint-ink)]">
                                <Users className="w-3 h-3" /> {act.teamFit}
                              </span>
                            </div>
                          )}
                          {plan.collaboration && plan.collaboration.members.length > 1 && (
                            <div className="mt-1.5 pl-6 flex flex-wrap gap-1">
                              {plan.collaboration.members
                                .filter(
                                  (member) =>
                                    act.teamFit?.includes(member.name) ||
                                    act.reasoning?.includes(member.name)
                                )
                                .map((member) => (
                                  <span
                                    key={member.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-[var(--rose-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--rose-ink)]"
                                  >
                                    主要照顾 {member.name}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-md border-t border-[var(--app-border)]/80 flex gap-3 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.06)] z-30">
        {onShare && collaborationMembers.length > 0 && (
          <button
            onClick={onShare}
            className="app-btn-ghost flex items-center justify-center gap-2 rounded-[24px] px-4 py-3.5 text-[13px] font-bold active:scale-[0.97] transition-transform cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            发给同行人
          </button>
        )}
        <button
          onClick={onConfirm}
          className="app-btn-primary flex flex-1 items-center justify-center gap-2 rounded-[24px] py-3.5 text-[15px] font-bold active:scale-[0.97] transition-transform cursor-pointer"
        >
          <Sparkles className="w-4 h-4" /> 进入执行
        </button>
      </div>
    </div>
  );
}
