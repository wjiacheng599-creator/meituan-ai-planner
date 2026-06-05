import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  MapPin,
  Clock,
  Utensils,
  PlusCircle,
  Wallet,
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  Users,
} from 'lucide-react';
import type { Plan, Activity } from '../../services/ai';
import { generateAlternatives } from '../../services/ai';
import GradientImg from '../ui/GradientImg';

interface AdjustPlanProps {
  plan?: Plan | null;
  onBack: () => void;
  onSelectOption: (option: string) => void;
  onReplaceActivity?: (activityId: string, newActivity: Activity) => void;
  onStartCollaboration?: () => void;
}

export default function AdjustPlan({
  plan,
  onBack,
  onSelectOption,
  onReplaceActivity,
  onStartCollaboration,
}: AdjustPlanProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Activity[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [selectedActivityForReplace, setSelectedActivityForReplace] = useState<Activity | null>(
    null
  );

  const options = [
    {
      id: 'spot',
      title: '替换景点',
      icon: MapPin,
      color: 'text-[var(--rose-ink)]',
      bg: 'bg-[var(--rose-soft)]',
    },
    {
      id: 'time',
      title: '调整时间',
      icon: Clock,
      color: 'text-[var(--sky-ink)]',
      bg: 'bg-[var(--sky-soft)]',
    },
    {
      id: 'food',
      title: '更换餐厅',
      icon: Utensils,
      color: 'text-[var(--peach-ink)]',
      bg: 'bg-[var(--peach-soft)]',
    },
    {
      id: 'add',
      title: '增加活动',
      icon: PlusCircle,
      color: 'text-[var(--mint-ink)]',
      bg: 'bg-[var(--mint-soft)]',
    },
    {
      id: 'budget',
      title: '预算调整',
      icon: Wallet,
      color: 'text-[var(--brand-ink)]',
      bg: 'bg-[var(--brand-soft)]',
    },
    {
      id: 'collab',
      title: '发起协作',
      icon: Users,
      color: 'text-[var(--peach-ink)]',
      bg: 'bg-[var(--peach-soft)]',
    },
  ];

  const handleOptionClick = async (optId: string) => {
    if (optId === 'collab') {
      onStartCollaboration?.();
      return;
    }
    if ((optId === 'spot' || optId === 'food') && plan && onReplaceActivity) {
      setSelectedOption(optId);
      return;
    }
    onSelectOption(optId);
  };

  const handleSelectActivityToReplace = async (act: Activity) => {
    setSelectedActivityForReplace(act);
    setLoadingAlts(true);
    try {
      const reason = selectedOption === 'food' ? '想换一家餐厅' : '想换一个景点';
      const alts = await generateAlternatives(act, reason);
      setAlternatives(alts);
    } catch {
      setAlternatives([]);
    } finally {
      setLoadingAlts(false);
    }
  };

  const handleReplaceWith = (alt: Activity) => {
    if (selectedActivityForReplace && onReplaceActivity) {
      onReplaceActivity(selectedActivityForReplace.id, alt);
      setSelectedOption(null);
      setSelectedActivityForReplace(null);
      setAlternatives([]);
    }
  };

  const handleSendPrompt = () => {
    if (prompt.trim()) {
      onSelectOption('ai_prompt:' + prompt.trim());
    }
  };

  if (selectedOption && plan && !selectedActivityForReplace) {
    return (
      <div className="app-shell flex h-full flex-col relative overflow-hidden">
        <div className="px-5 pt-14 pb-4 bg-transparent flex items-center relative z-20">
          <button
            onClick={() => setSelectedOption(null)}
            className="w-10 h-10 flex items-center justify-center bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-[var(--app-border)] text-[var(--app-ink)] hover:text-black hover:bg-white transition-all absolute left-4"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="flex-1 text-center font-bold text-[var(--app-ink)] text-[15px]">
            选择要{selectedOption === 'food' ? '更换的餐厅' : '替换的景点'}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24 space-y-3">
          {plan.activities
            .filter((a) => (selectedOption === 'food' ? a.type === 'food' : a.type === 'activity'))
            .map((act, i) => (
              <motion.button
                key={act.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleSelectActivityToReplace(act)}
                className="w-full bg-white rounded-[24px] p-4 shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[var(--app-border)] flex items-center justify-between group hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[var(--app-card-soft)] overflow-hidden shrink-0">
                    <GradientImg
                      src={act.imageUrl || 'gradient:blue-purple'}
                      alt={act.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-[var(--app-ink)] text-[13px]">{act.title}</span>
                    <span className="text-[11px] text-[var(--app-text-soft)] font-medium">
                      {act.timeLine} · ¥{act.price}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--app-text-soft)]" />
              </motion.button>
            ))}
          {plan.activities.filter((a) =>
            selectedOption === 'food' ? a.type === 'food' : a.type === 'activity'
          ).length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 opacity-50">
              <p className="text-[var(--app-text)] font-medium">
                没有找到可替换的{selectedOption === 'food' ? '餐厅' : '景点'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedActivityForReplace) {
    return (
      <div className="app-shell flex h-full flex-col relative overflow-hidden">
        <div className="px-5 pt-14 pb-4 bg-transparent flex items-center relative z-20">
          <button
            onClick={() => {
              setSelectedActivityForReplace(null);
              setAlternatives([]);
            }}
            className="w-10 h-10 flex items-center justify-center bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-[var(--app-border)] text-[var(--app-ink)] hover:text-black hover:bg-white transition-all absolute left-4"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="flex-1 text-center font-bold text-[var(--app-ink)] text-[15px]">
            替换「{selectedActivityForReplace.title}」
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24 space-y-3">
          {loadingAlts ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="w-8 h-8 text-[var(--brand-ink)] animate-spin" />
              <p className="text-[var(--app-text)] font-bold text-[13px]">
                AI 正在为你寻找替代方案...
              </p>
            </div>
          ) : alternatives.length > 0 ? (
            alternatives.map((alt, i) => (
              <motion.button
                key={alt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleReplaceWith(alt)}
                className="w-full bg-white rounded-[24px] p-4 shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[var(--app-border)] flex items-start gap-3 hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-all"
              >
                <div className="w-16 h-16 rounded-xl bg-[var(--app-card-soft)] overflow-hidden shrink-0">
                  <GradientImg
                    src={alt.imageUrl || 'gradient:orange-red'}
                    alt={alt.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col items-start gap-1">
                  <span className="font-bold text-[var(--app-ink)] text-[13px]">{alt.title}</span>
                  <span className="text-[11px] text-[var(--app-text-soft)] font-medium">
                    {alt.timeLine} · ¥{alt.price}
                  </span>
                  <p className="text-[13px] text-[var(--app-text)] leading-relaxed mt-1">
                    {alt.description}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {(alt.tags ?? []).map((tag, j) => (
                      <span
                        key={j}
                        className="text-[10px] bg-[var(--brand-soft)] text-[var(--brand-ink)] px-2 py-0.5 rounded-full font-bold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 opacity-50">
              <p className="text-[var(--app-text)] font-medium">暂无替代方案，请稍后重试</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex h-full flex-col relative overflow-hidden">
      <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-[rgba(255,216,77,0.16)] rounded-full blur-[60px] pointer-events-none"></div>

      <div className="px-5 pt-14 pb-4 bg-transparent flex items-center relative z-20">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-[var(--app-border)] text-[var(--app-ink)] hover:text-black hover:bg-white transition-all absolute left-4"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-24 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h2 className="text-[26px] font-bold text-[var(--app-ink)] mb-8 mt-2 tracking-tight">
            想要调整方案吗？
          </h2>

          <div className="space-y-3.5">
            {options.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <motion.button
                  key={opt.id}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleOptionClick(opt.id)}
                  className="w-full bg-white rounded-[24px] p-4 shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[var(--app-border)] flex items-center justify-between group hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 ${opt.bg}`}
                    >
                      <Icon className={`w-6 h-6 ${opt.color}`} />
                    </div>
                    <span className="font-bold text-[var(--app-ink)] text-[15px]">{opt.title}</span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-[var(--app-text-soft)] rotate-180 group-hover:text-[var(--app-text-soft)]" />
                </motion.button>
              );
            })}
          </div>

          <div className="mt-12">
            <h3 className="text-[15px] font-bold text-[var(--app-ink)] mb-3 flex items-center">
              <Sparkles className="w-5 h-5 text-[var(--brand-ink)] mr-1.5" />
              智能优化
            </h3>
            <div className="bg-white rounded-[24px] p-2 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[var(--app-border)] flex items-end relative overflow-hidden group focus-within:shadow-[0_8px_30px_rgba(255,200,58,0.15)] focus-within:border-[#ffe2a3] transition-all">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                placeholder="例如：不想去美术馆，换成喝咖啡..."
                className="flex-1 bg-transparent border-none text-[13px] text-[var(--app-ink)] placeholder-gray-400 focus:ring-0 p-3 pt-4 resize-none h-[80px]"
              />
              <button
                onClick={handleSendPrompt}
                disabled={!prompt.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center mr-2 mb-2 transition-all flex-shrink-0 ${prompt.trim() ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-md hover:opacity-90' : 'bg-[var(--app-card-soft)] text-[var(--app-text-soft)]'}`}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
