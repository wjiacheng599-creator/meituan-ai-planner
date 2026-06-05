import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import type { Plan } from '../../services/ai';
import { generatePlan } from '../../services/ai';
import GradientImg from '../ui/GradientImg';

interface BackupsProps {
  currentPlan?: Plan | null;
  onBack: () => void;
  onSelectBackup: (plan: Plan) => void;
}

export default function Backups({ currentPlan, onBack, onSelectBackup }: BackupsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const handleSelectBackup = async (query: string) => {
    setLoading(query);
    try {
      const newPlan = await generatePlan(query);
      setSelectedPlan(newPlan);
      onSelectBackup(newPlan);
    } catch {
      if (currentPlan) {
        onSelectBackup(currentPlan);
      }
    } finally {
      setLoading(null);
    }
  };

  const backups = [
    {
      id: 'backup-2',
      title: '方案二：文艺展览之旅',
      desc: '适合喜欢艺术的家庭，以美术馆和创意空间为主',
      query: '文艺展览之旅，美术馆和创意空间',
      duration: '4-5小时',
      image: 'gradient:purple-pink',
    },
    {
      id: 'backup-3',
      title: '方案三：城市漫步之旅',
      desc: '适合喜欢散步和美食的家庭，轻松惬意',
      query: '城市漫步美食之旅，轻松惬意的路线',
      duration: '4-6小时',
      image: 'gradient:orange-amber',
    },
  ];

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="px-5 pt-14 pb-3 bg-white/82 backdrop-blur-xl flex items-center shadow-[0_6px_18px_rgba(20,24,33,0.04)] relative z-20 border-b border-[var(--app-border)]">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-start absolute left-5"
        >
          <ChevronLeft className="w-7 h-7 text-[var(--app-ink)]" />
        </button>
        <span className="flex-1 text-center font-bold text-lg text-[#141821]">
          为你准备的备选方案
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
        <p className="text-[var(--app-text)] font-medium text-[13px] mb-6">
          根据您的偏好，推荐更多精彩选择
        </p>

        <div className="space-y-6">
          {backups.map((backup, i) => (
            <motion.div
              key={backup.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="app-card rounded-[24px] overflow-hidden cursor-pointer hover:shadow-[0_14px_34px_rgba(20,24,33,0.08)] active:scale-[0.98] transition-all"
              onClick={() => handleSelectBackup(backup.query)}
            >
              <div className="h-40 w-full relative">
                <GradientImg
                  src={backup.image}
                  alt={backup.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                {loading === backup.query && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="p-5 -mt-5 relative bg-white rounded-t-3xl border-t border-[var(--app-border)]">
                <h3 className="text-lg font-bold text-[var(--app-ink)] mb-1">{backup.title}</h3>
                <p className="text-[13px] text-[var(--app-text)] mb-3">{backup.desc}</p>
                <span className="inline-block app-card-soft text-[var(--app-text)] text-[11px] font-bold px-2 py-1 rounded">
                  预计时长: {backup.duration}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)] flex pb-safe z-30 justify-center shadow-[0_-8px_26px_rgba(20,24,33,0.05)]">
        <button
          onClick={() => {
            if (selectedPlan) {
              onSelectBackup(selectedPlan);
            } else if (currentPlan) {
              onSelectBackup(currentPlan);
            } else {
              handleSelectBackup(backups[0].query);
            }
          }}
          disabled={loading !== null}
          className="app-btn-primary w-full font-bold py-3.5 rounded-full transition-colors text-lg cursor-pointer active:scale-95 disabled:opacity-50"
        >
          查看完整方案
        </button>
      </div>
    </div>
  );
}
