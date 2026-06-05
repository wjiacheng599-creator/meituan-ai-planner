import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  RotateCcw,
  Search,
  Forward,
  Trash2,
  Pause,
  AlertCircle,
  Clock,
  Users,
  Wifi,
  HelpCircle,
  ArmchairIcon,
  Ticket,
} from 'lucide-react';
import type { Activity } from '../../services/ai';

export type FailureReason =
  | 'no_seat'
  | 'no_ticket'
  | 'time_conflict'
  | 'merchant_unavailable'
  | 'capacity_exceeded'
  | 'network_error'
  | 'unknown_error';

export type FailureAction =
  | 'retry'
  | 'search_alternative'
  | 'skip'
  | 'delete'
  | 'pause'
  | 'change_time'
  | 'change_date';

interface BookingFailureDialogProps {
  isOpen: boolean;
  activity: Activity;
  reason: FailureReason;
  errorMessage?: string;
  onAction: (action: FailureAction) => void;
  onClose: () => void;
}

const reasonConfig: Record<
  FailureReason,
  {
    icon: React.ComponentType<any>;
    title: string;
    description: string;
    primaryAction: FailureAction;
    secondaryActions: FailureAction[];
    colorClass: string;
  }
> = {
  no_seat: {
    icon: ArmchairIcon,
    title: '暂无可用座位',
    description: '该餐厅当前时段已满座，没有可用位置。建议换个时段或选择附近同类餐厅。',
    primaryAction: 'search_alternative',
    secondaryActions: ['change_time', 'skip', 'delete'],
    colorClass: 'text-orange-500 bg-orange-50 border-orange-200',
  },
  no_ticket: {
    icon: Ticket,
    title: '门票已售罄',
    description: '该景点/活动门票已售完。建议选择同类型替代景点或换个日期。',
    primaryAction: 'search_alternative',
    secondaryActions: ['change_date', 'skip', 'delete'],
    colorClass: 'text-rose-500 bg-rose-50 border-rose-200',
  },
  time_conflict: {
    icon: Clock,
    title: '行程时间冲突',
    description: '该活动与前后行程时间重叠，无法按时完成。建议自动调整或压缩前序活动。',
    primaryAction: 'retry',
    secondaryActions: ['change_time', 'skip', 'delete'],
    colorClass: 'text-amber-500 bg-amber-50 border-amber-200',
  },
  merchant_unavailable: {
    icon: AlertCircle,
    title: '商家暂时不可用',
    description: '这家店铺可能已经打烊、休息或暂时关闭了。',
    primaryAction: 'search_alternative',
    secondaryActions: ['skip', 'delete', 'pause'],
    colorClass: 'text-orange-500 bg-orange-50 border-orange-200',
  },
  capacity_exceeded: {
    icon: Users,
    title: '人数超限',
    description: '该活动/餐厅目前无法接待你们这么多人。',
    primaryAction: 'search_alternative',
    secondaryActions: ['skip', 'delete', 'pause'],
    colorClass: 'text-rose-500 bg-rose-50 border-rose-200',
  },
  network_error: {
    icon: Wifi,
    title: '网络连接问题',
    description: '暂时无法连接到服务，可能是网络不稳定。',
    primaryAction: 'retry',
    secondaryActions: ['skip', 'pause', 'delete'],
    colorClass: 'text-sky-500 bg-sky-50 border-sky-200',
  },
  unknown_error: {
    icon: HelpCircle,
    title: '预订失败',
    description: '出现了一些意外问题，无法完成预订。',
    primaryAction: 'retry',
    secondaryActions: ['skip', 'delete', 'pause'],
    colorClass: 'text-gray-500 bg-gray-50 border-gray-200',
  },
};

const actionConfig: Record<
  FailureAction,
  {
    label: string;
    icon: React.ComponentType<any>;
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  }
> = {
  retry: { label: '重试预订', icon: RotateCcw, variant: 'primary' },
  search_alternative: { label: '找替代商家', icon: Search, variant: 'primary' },
  skip: { label: '跳过这个', icon: Forward, variant: 'secondary' },
  delete: { label: '从行程删除', icon: Trash2, variant: 'danger' },
  pause: { label: '先暂停', icon: Pause, variant: 'ghost' },
  change_time: { label: '换个时段', icon: Clock, variant: 'secondary' },
  change_date: { label: '换个日期', icon: RotateCcw, variant: 'secondary' },
};

export function analyzeFailureReason(errorMessage?: string): FailureReason {
  if (!errorMessage) return 'unknown_error';
  const message = errorMessage.toLowerCase();

  // 比赛要求：3类核心故障
  if (
    message.includes('满座') ||
    message.includes('无座') ||
    message.includes('没座') ||
    message.includes('满员') ||
    message.includes('没有位置') ||
    message.includes('座位已满') ||
    message.includes('no seat') ||
    message.includes('fully booked')
  ) {
    return 'no_seat';
  }

  if (
    message.includes('售罄') ||
    message.includes('无票') ||
    message.includes('没票') ||
    message.includes('售完') ||
    message.includes('卖完') ||
    message.includes('缺票') ||
    message.includes('sold out') ||
    message.includes('no ticket')
  ) {
    return 'no_ticket';
  }

  if (
    message.includes('时间冲突') ||
    message.includes('冲突') ||
    message.includes('重叠') ||
    message.includes('撞时间') ||
    message.includes('来不及') ||
    message.includes('赶不上') ||
    message.includes('time conflict') ||
    message.includes('overlap')
  ) {
    return 'time_conflict';
  }

  // 原有识别逻辑
  if (
    message.includes('打烊') ||
    message.includes('休息') ||
    message.includes('关门') ||
    message.includes('不可用')
  ) {
    return 'merchant_unavailable';
  }
  if (message.includes('已满') || message.includes('预约满') || message.includes('时段')) {
    return 'time_conflict';
  }
  if (message.includes('人') && (message.includes('太多') || message.includes('超过'))) {
    return 'capacity_exceeded';
  }
  if (message.includes('网络') || message.includes('连接') || message.includes('超时')) {
    return 'network_error';
  }
  return 'unknown_error';
}

export default function BookingFailureDialog({
  isOpen,
  activity,
  reason,
  errorMessage,
  alternatives,
  onAction,
  onClose,
}: BookingFailureDialogProps & { alternatives?: string[] }) {
  const config = reasonConfig[reason];
  const Icon = config.icon;

  const handleAction = (action: FailureAction) => {
    onAction(action);
    onClose();
  };

  const renderButton = (action: FailureAction, isPrimary = false) => {
    const { label, icon: ActionIcon, variant } = actionConfig[action];
    const baseClasses =
      'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all cursor-pointer active:scale-[0.98]';

    let variantClasses = '';
    switch (variant) {
      case 'primary':
        variantClasses =
          'bg-[#F97316] text-white shadow-[0_6px_14px_rgba(249,115,22,0.25)] hover:bg-[#ea580c]';
        break;
      case 'secondary':
        variantClasses = 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50';
        break;
      case 'danger':
        variantClasses = 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50';
        break;
      case 'ghost':
        variantClasses = 'text-gray-500 hover:text-gray-700 hover:bg-gray-50';
        break;
    }

    return (
      <motion.button
        key={action}
        whileHover={{ scale: isPrimary ? 1.02 : 1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleAction(action)}
        className={`${baseClasses} ${variantClasses}`}
      >
        <ActionIcon className="w-4 h-4" />
        {label}
      </motion.button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-t-[32px] p-6 pb-8 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className={`mx-auto mb-6 w-16 h-16 rounded-[24px] flex items-center justify-center border-2 ${config.colorClass}`}
            >
              <Icon className="w-7 h-7" />
            </div>

            <h2 className="text-[20px] font-bold text-gray-900 text-center mb-2">{config.title}</h2>
            <p className="text-[13px] font-bold text-gray-500 text-center mb-4">
              {config.description}
            </p>

            {errorMessage && (
              <div className="mb-6 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[11px] text-gray-600 font-medium">错误信息：{errorMessage}</p>
              </div>
            )}

            <div className="mb-6 p-4 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA]">
              <h3 className="text-[13px] font-bold text-gray-900 mb-2">失败的活动</h3>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-900 truncate">{activity.title}</p>
                  <p className="text-[11px] font-bold text-gray-500 mt-1">
                    {activity.timeLine} · ¥{activity.price}
                  </p>
                </div>
              </div>
            </div>

            {/* 替代方案建议 */}
            {alternatives && alternatives.length > 0 && (
              <div className="mb-6 p-4 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0]">
                <h3 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-500" />
                  推荐的替代选择
                </h3>
                <div className="space-y-2">
                  {alternatives.slice(0, 3).map((alt, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-100"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600 flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-medium text-gray-700 truncate">{alt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {renderButton(config.primaryAction, true)}

              <div className="grid grid-cols-2 gap-3">
                {config.secondaryActions.map((action) => renderButton(action))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
