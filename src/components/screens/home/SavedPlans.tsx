import React from 'react';
import { ArrowRight, MapPin, Clock, Users, Sparkles } from 'lucide-react';
import GradientImg from '../../ui/GradientImg';
import type { Plan, Activity } from '../../../services/ai';

interface SavedPlansProps {
  plan: Plan;
  content?: string;
  onViewActivity: (act: Activity) => void;
  onSavePlan: (plan: Plan) => void;
  onViewItinerary: (plan: Plan) => void;
}

const SavedPlans = React.memo(function SavedPlans({
  plan,
  content,
  onViewActivity,
  onSavePlan,
  onViewItinerary,
}: SavedPlansProps) {
  return (
    <div className="flex items-start gap-2.5 w-full mt-2 relative">
      <div className="absolute -top-3 -right-2 z-20 flex -rotate-3 items-center gap-1 rounded-full border border-white bg-[linear-gradient(135deg,var(--rose-soft)_0%,var(--peach-soft)_100%)] px-2.5 py-1 text-[10px] font-semibold text-[var(--rose-ink)] shadow-[0_4px_12px_rgba(201,75,134,0.1)]">
        <Sparkles className="w-3 h-3" /> 专属推荐
      </div>
      <div className="app-card relative flex flex-1 flex-col overflow-hidden rounded-[24px] group">
        <div className="h-36 relative overflow-hidden shrink-0 rounded-t-[28px]">
          <GradientImg
            src={plan.activities[0]?.imageUrl || 'gradient:blue-purple'}
            alt={plan.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />

          <div className="absolute bottom-3 left-4 right-4 z-20 flex justify-between items-end">
            <div className="min-w-0 pr-3">
              <div className="text-white/80 text-[10px] font-bold mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> AI 行程卡片
              </div>
              <h3 className="line-clamp-2 break-words text-[18px] font-bold leading-tight text-white">
                {plan.title}
              </h3>
            </div>
            {plan.durationTags && (
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0 ml-2">
                <Clock className="w-3 h-3 text-white" />
                <span className="text-[10px] font-bold text-white">{plan.durationTags}</span>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="p-4 bg-white flex flex-col gap-3 rounded-b-[28px]">
          <div className="flex gap-2">
            <div className="bg-[var(--app-card-soft)] flex-1 rounded-2xl p-2.5 flex items-center gap-2.5 border border-[var(--app-border)] flex-col sm:flex-row sm:items-center justify-center">
              <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--app-border)] shrink-0">
                <MapPin className="w-3.5 h-3.5 text-[var(--app-text)]" />
              </div>
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left overflow-hidden">
                <div className="text-[10px] text-[var(--app-text)] font-bold mb-0.5">途径地点</div>
                <div className="w-full truncate text-[13px] font-bold text-[var(--app-ink)]">
                  {plan.activities.length} 个精华点
                </div>
              </div>
            </div>
            <div className="bg-[var(--app-card-soft)] flex-1 rounded-2xl p-2.5 flex items-center gap-2.5 border border-[var(--app-border)] flex-col sm:flex-row sm:items-center justify-center">
              <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--app-border)] shrink-0">
                <Clock className="w-3.5 h-3.5 text-[var(--app-text)]" />
              </div>
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left overflow-hidden">
                <div className="text-[10px] text-[var(--app-text)] font-bold mb-0.5">游玩时长</div>
                <div className="w-full truncate text-[13px] font-bold text-[var(--app-ink)]">
                  {plan.durationTags || '精选安排'}
                </div>
              </div>
            </div>
          </div>

          {content && (
            <p className="text-[13px] font-bold text-[var(--app-text)] leading-relaxed -mt-1">
              {content}
            </p>
          )}

          {plan.collaboration && (
            <div className="rounded-xl border border-[var(--rose-strong)] bg-[linear-gradient(135deg,rgba(255,247,251,0.95)_0%,rgba(255,241,225,0.6)_100%)] p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-[var(--rose-ink)]" />
                <span className="text-[11px] font-bold text-[var(--app-ink)]">共创结果</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {plan.collaboration.consensus.slice(0, 3).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/70 bg-white/86 px-2 py-0.5 text-[10px] font-semibold text-[var(--rose-ink)] shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Highlight Images Strip */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mt-1 -mx-2 px-2 snap-x">
            {plan.activities.slice(0, 4).map((act, i) => (
              <div
                key={act.id || `img-${i}`}
                onClick={() => onViewActivity(act)}
                className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 shadow-sm border border-[var(--app-border)] relative group snap-center cursor-pointer active:scale-95 transition-transform"
              >
                <GradientImg
                  src={act.imageUrl || 'gradient:blue-purple'}
                  alt={act.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-bold text-white line-clamp-1 leading-tight">
                  {act.title}
                </div>
              </div>
            ))}
            {plan.activities.length > 4 && (
              <div className="w-[72px] h-[72px] rounded-xl bg-[var(--app-card-soft)] border border-[var(--app-border)] flex items-center justify-center shrink-0 snap-center">
                <span className="text-[13px] font-semibold text-[var(--app-text-soft)]">
                  +{plan.activities.length - 4}
                </span>
              </div>
            )}
          </div>

          {/* Highlights Tags */}
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {plan.activities.slice(0, 3).map((act, i) => (
              <span
                key={act.id || `tag-${i}`}
                className="max-w-[80px] truncate rounded-[6px] border border-[var(--peach-strong)] bg-[var(--peach-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--peach-ink)]"
              >
                {act.title}
              </span>
            ))}
          </div>

          <button
            onClick={() => {
              onSavePlan(plan);
              onViewItinerary(plan);
            }}
            className="app-btn-primary group/btn mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-semibold transition-all active:scale-[0.98] cursor-pointer"
          >
            查看完整行程{' '}
            <ArrowRight
              className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5"
              strokeWidth={3}
            />
          </button>
        </div>
      </div>
    </div>
  );
});

export default SavedPlans;
