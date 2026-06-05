import { motion } from 'motion/react';
import { ChevronLeft, BookOpen, Clock, MapPin, Sparkles } from 'lucide-react';
import type { Plan } from '../../services/ai';
import type { PlannerTaskState } from '../../types';
import GradientImg from '../ui/GradientImg';
import { getPlannerTaskMeta, getPlannerTaskProgressText } from '../../utils/plannerTask';
import { loadAllStories, loadCheckinRecords } from '../../services/storage';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';
import EmptyState from '../ui/EmptyState';

interface MemoriesProps {
  completedPlans: Plan[];
  plannerTaskStates?: PlannerTaskState[];
  onViewStory: (plan: Plan) => void;
  onBack: () => void;
}

export default function Memories({
  completedPlans,
  plannerTaskStates = [],
  onViewStory,
  onBack,
}: MemoriesProps) {
  const taskStateMap = new Map(plannerTaskStates.map((item) => [item.planId, item]));
  const storyMap = loadAllStories();
  const checkinRecords = loadCheckinRecords();
  const memoryPlans = completedPlans.filter((plan) => {
    if (!plan.id) return false;
    const story = storyMap[plan.id];
    return !!story?.title;
  });

  return (
    <div className="flex h-full flex-col bg-transparent relative overflow-hidden">
      <div className="px-5 pt-14 pb-2 bg-white/82 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between shadow-[0_6px_18px_rgba(20,24,33,0.04)] border-b border-[var(--app-border)]">
        <button
          onClick={onBack}
          className="app-pill w-10 h-10 flex items-center justify-center rounded-full text-[var(--app-ink)] hover:text-black hover:bg-[var(--app-card-soft)] transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-[#141821] text-[18px]">我的回忆录</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
        {memoryPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <EmptyState
              mood="love"
              title="还没有回忆录"
              description="完成行程并打卡后，这里会留下美好回忆"
            />
          </div>
        ) : (
          <div className="space-y-5">
            {memoryPlans.map((plan, idx) => {
              const taskState = taskStateMap.get(plan.id || '') || null;
              const meta = getPlannerTaskMeta(taskState?.status);
              const progressText = getPlannerTaskProgressText(taskState, plan.activities.length);
              const coverRecord = checkinRecords.find(
                (record) => record.planId === plan.id && record.photoDataUrl
              );
              const story = storyMap[plan.id || ''];

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={plan.id}
                  onClick={() => onViewStory(plan)}
                  className="app-card rounded-[24px] p-4 flex gap-4 cursor-pointer hover:shadow-[0_12px_28px_rgba(20,24,33,0.08)] transition-all"
                >
                  <div className="w-24 h-24 rounded-xl overflow-hidden relative shadow-sm shrink-0 bg-[var(--app-card-soft)]">
                    <GradientImg
                      src={
                        coverRecord?.photoDataUrl ||
                        plan.activities[0]?.imageUrl ||
                        `gradient:pink-yellow`
                      }
                      className="w-full h-full object-cover"
                      alt="Memory Cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md rounded-md px-1.5 py-0.5 text-[10px] text-white font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[var(--brand)]" />
                      AI 生成
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col pt-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-[var(--app-ink)] text-[15px] leading-tight line-clamp-2">
                        {story?.title || plan.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${meta.pillClassName}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-auto space-y-1.5">
                      <p className="text-[13px] text-[var(--app-text)] font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> {progressText}
                      </p>
                      <p className="text-[13px] text-[var(--app-text-soft)] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> 点击查看回忆录
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
