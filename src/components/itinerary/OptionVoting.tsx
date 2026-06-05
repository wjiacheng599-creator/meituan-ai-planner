import React, { useState } from 'react';
import { Check, Users } from 'lucide-react';

export interface VotingOption {
  id: string;
  label: string;
  description?: string;
}

export interface OptionVotingProps {
  options: VotingOption[];
  maxSelections: number;
  title: string;
  onVote: (selectedIds: string[]) => void;
}

export default function OptionVoting({ options, maxSelections, title, onVote }: OptionVotingProps) {
  // 安全地处理选项数据
  const safeOptions = Array.isArray(options)
    ? options.map((opt) => ({
        id: typeof opt.id === 'string' ? opt.id : `opt_${Math.random().toString(36).substring(7)}`,
        label: typeof opt.label === 'string' ? opt.label : '选项',
        description: typeof opt.description === 'string' ? opt.description : undefined,
      }))
    : [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const handleToggle = (id: string) => {
    if (confirmed) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= maxSelections) {
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) return;
    setConfirmed(true);
    onVote(Array.from(selectedIds));
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-100/60">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-[var(--peach-ink)]" />
        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
      </div>

      <p className="text-[13px] text-gray-400 mb-4">
        {confirmed
          ? '投票已确认'
          : `最多可选 ${maxSelections} 项 · 已选 ${selectedIds.size}/${maxSelections}`}
      </p>

      <div className="space-y-2 mb-5">
        {safeOptions.map((option) => {
          const isSelected = selectedIds.has(option.id);
          return (
            <button
              key={option.id}
              onClick={() => handleToggle(option.id)}
              disabled={confirmed}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] cursor-pointer
                ${confirmed ? 'opacity-60 cursor-default' : ''}
                ${
                  isSelected
                    ? 'border-[var(--peach-ink)] bg-[var(--peach-soft)] shadow-[0_2px_8px_rgba(217,139,76,0.15)]'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200
                    ${
                      isSelected
                        ? 'border-[var(--peach-ink)] bg-[var(--peach-ink)]'
                        : 'border-gray-300'
                    }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-[13px] font-semibold ${isSelected ? 'text-[var(--peach-ink)]' : 'text-gray-800'}`}
                  >
                    {option.label}
                  </div>
                  {option.description && (
                    <div className="text-[13px] text-gray-400 mt-0.5 leading-relaxed">
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!confirmed && (
        <button
          onClick={handleConfirm}
          disabled={selectedIds.size === 0}
          className="app-btn-primary w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          确认选择 ({selectedIds.size})
        </button>
      )}

      {confirmed && (
        <div className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-[var(--mint-ink)] bg-[var(--mint-soft)] rounded-2xl">
          <Check className="w-4 h-4" />
          已投票
        </div>
      )}
    </div>
  );
}
