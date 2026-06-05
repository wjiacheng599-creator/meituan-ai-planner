import { Clock, MapPin, AlertCircle } from 'lucide-react';
import type { Order } from '../../types';

interface OrderCardProps {
  order: Order;
  onCancel?: (orderId: string) => void;
  onRefund?: (orderId: string) => void;
  onDelete?: (orderId: string) => void;
  isLoading?: boolean;
}

/** 订单状态映射 */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待支付', color: 'text-amber-600', bg: 'bg-amber-50' },
  paid: { label: '已支付', color: 'text-blue-600', bg: 'bg-blue-50' },
  in_progress: { label: '进行中', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  completed: { label: '已完成', color: 'text-gray-600', bg: 'bg-gray-50' },
  canceled: { label: '已取消', color: 'text-slate-400', bg: 'bg-slate-50' },
  refunding: { label: '退款中', color: 'text-orange-500', bg: 'bg-orange-50' },
  refunded: { label: '已退款', color: 'text-slate-400', bg: 'bg-slate-50' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

export default function OrderCard({
  order,
  onCancel,
  onRefund,
  onDelete,
  isLoading,
}: OrderCardProps) {
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const canCancel = order.status === 'pending' || order.status === 'paid';
  const canRefund = order.status === 'paid' || order.status === 'in_progress';
  const canDelete =
    order.status === 'canceled' || order.status === 'completed' || order.status === 'refunded';

  return (
    <div className="app-card rounded-[24px] p-5 flex flex-col space-y-3">
      {/* 头部：标题 + 状态 */}
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-[15px] text-gray-900 leading-tight pr-2 flex-1">
          {order.title}
        </h4>
        <span
          className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg ${statusConfig.bg} ${statusConfig.color}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* 信息行 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
          <span className="truncate">{order.merchantName}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
          <span>{formatTime(order.createdAt)}</span>
        </div>
      </div>

      {/* 金额 + 操作按钮 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="font-bold text-[18px] text-gray-900">¥{order.amount}</span>
        <div className="flex gap-2">
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-[12px] text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
            >
              取消
            </button>
          )}
          {canRefund && onRefund && (
            <button
              onClick={() => onRefund(order.id)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-[12px] text-[13px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" strokeWidth={2} />
              退款
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(order.id)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-[12px] text-[13px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
            >
              删除
            </button>
          )}
        </div>
      </div>

      {/* 退款状态信息 */}
      {order.refundStatus && order.refundStatus !== 'none' && (
        <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-orange-400" />
          退款状态:{' '}
          {order.refundStatus === 'requested'
            ? '已申请'
            : order.refundStatus === 'approved'
              ? '已批准'
              : order.refundStatus === 'rejected'
                ? '已拒绝'
                : order.refundStatus}
          {order.refundReason && <span> - {order.refundReason}</span>}
        </div>
      )}
    </div>
  );
}
