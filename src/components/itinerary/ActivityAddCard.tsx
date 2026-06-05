import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, PlusCircle, Clock } from 'lucide-react';

export interface ActivityAddOption {
  id: string;
  title: string;
  type: string;
  price: number;
  description: string;
  reason: string;
  insertAfter?: string;
  timeLine?: string;
  tags?: string[];
}

export interface ActivityAddCardProps {
  title: string;
  options: ActivityAddOption[];
  onConfirm: (selected: ActivityAddOption[]) => void;
  onCancel?: () => void;
}

export default function ActivityAddCard({
  title,
  options,
  onConfirm,
  onCancel,
}: ActivityAddCardProps) {
  const safeTitle = typeof title === 'string' ? title : '推荐增加';

  // 安全地处理选项数据，确保格式正确
  const safeOptions = Array.isArray(options)
    ? options.map((opt) => ({
        id: typeof opt.id === 'string' ? opt.id : `opt_${Math.random().toString(36).substring(7)}`,
        title: typeof opt.title === 'string' ? opt.title : '推荐选项',
        type: typeof opt.type === 'string' ? opt.type : 'activity',
        price: typeof opt.price === 'number' ? opt.price : 0,
        description: typeof opt.description === 'string' ? opt.description : '',
        reason: typeof opt.reason === 'string' ? opt.reason : '',
        insertAfter: typeof opt.insertAfter === 'string' ? opt.insertAfter : undefined,
        timeLine: typeof opt.timeLine === 'string' ? opt.timeLine : undefined,
        tags: Array.isArray(opt.tags) ? opt.tags : undefined,
      }))
    : [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const toggleOption = (id: string) => {
    if (confirmed) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = safeOptions.filter((o) => selectedIds.has(o.id));
    if (selected.length > 0) {
      setConfirmed(true);
      onConfirm(selected);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
          <PlusCircle className="w-4 h-4 text-emerald-500" />
        </div>
        <p className="text-[13px] font-bold text-gray-700">{safeTitle}</p>
      </div>

      {/* 选项列表 */}
      <div className="space-y-1.5 mb-4">
        {safeOptions.map((opt, i) => (
          <motion.button
            key={opt.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => toggleOption(opt.id)}
            disabled={confirmed}
            className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
              selectedIds.has(opt.id)
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
            } ${confirmed ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
          >
            {/* 多选框 */}
            <div
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                selectedIds.has(opt.id) ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300'
              }`}
            >
              {selectedIds.has(opt.id) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-gray-800 truncate">{opt.title}</span>
                <span className="text-[13px] font-bold text-gray-500 ml-2">¥{opt.price}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">{opt.reason}</p>
              {opt.insertAfter && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-medium">
                  <Clock className="w-3 h-3" />
                  建议在「{opt.insertAfter}」之后
                </div>
              )}
              {opt.tags && opt.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {opt.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded-md bg-white text-[10px] font-medium text-gray-500 border border-gray-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={confirmed}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-all"
          >
            取消
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={confirmed || selectedIds.size === 0}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-emerald-400 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-default transition-all flex items-center justify-center gap-1.5"
        >
          {confirmed ? (
            <>
              <Check className="w-4 h-4" /> 已添加
            </>
          ) : (
            `确认添加${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`
          )}
        </button>
      </div>
    </motion.div>
  );
}
