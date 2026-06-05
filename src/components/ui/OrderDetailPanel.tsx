import { useState } from 'react';
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  RotateCcw,
  Loader2,
  MapPin,
  Calendar,
  Receipt,
} from 'lucide-react';
import type { Order } from '../../types';
import type { TripOrderGroup } from './TripOrderCard';

interface OrderDetailPanelProps {
  group: TripOrderGroup;
  onBack: () => void;
  onCancel?: (orderId: string) => void;
  onRefund?: (orderId: string) => void;
  onDelete?: (orderId: string) => void;
  actionLoading?: string | null;
}

function getStatusInfo(status: string) {
  switch (status) {
    case 'completed':
      return { label: '已完成', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
    case 'paid':
      return { label: '已支付', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle2 };
    case 'pending':
      return { label: '待支付', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock };
    case 'canceled':
      return { label: '已取消', color: 'text-gray-500', bg: 'bg-gray-50', icon: XCircle };
    case 'refunding':
      return { label: '退款中', color: 'text-orange-600', bg: 'bg-orange-50', icon: RotateCcw };
    case 'refunded':
      return { label: '已退款', color: 'text-gray-500', bg: 'bg-gray-50', icon: RotateCcw };
    default:
      return { label: '未知', color: 'text-gray-500', bg: 'bg-gray-50', icon: Package };
  }
}

function getAvailableActions(status: string): Array<'cancel' | 'refund' | 'delete'> {
  switch (status) {
    case 'pending':
      return ['cancel', 'delete'];
    case 'paid':
      return ['refund'];
    case 'completed':
      return ['refund'];
    case 'canceled':
    case 'refunded':
      return ['delete'];
    default:
      return [];
  }
}

function getOrderDisplayName(order: Order): string {
  if (order.merchantName) return order.merchantName;
  const title = order.title || '';
  const dashIndex = title.indexOf(' - ');
  if (dashIndex > 0) return title.substring(dashIndex + 3);
  return title;
}

export default function OrderDetailPanel({
  group,
  onBack,
  onCancel,
  onRefund,
  onDelete,
  actionLoading,
}: OrderDetailPanelProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const date = new Date(group.createdAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-white animate-slide-in-right pt-14">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-14 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 active:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-[15px] font-medium">返回</span>
        </button>
        <h2 className="text-[15px] font-bold text-gray-900">订单详情</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-4 mt-4 rounded-[24px] bg-gradient-to-br from-blue-50 to-indigo-50 p-5 border border-blue-100">
          <h3 className="text-[18px] font-bold text-gray-900 mb-2">{group.title}</h3>
          <div className="flex items-center gap-4 text-[13px] text-gray-600">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-500" />
              {dateStr}
            </span>
            <span className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-blue-500" />
              {group.orders.length} 个订单
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-100">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-gray-600">订单总额</span>
              <span className="text-[20px] font-bold text-gray-900">¥{group.totalAmount}</span>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 pb-6">
          <h4 className="text-[13px] font-semibold text-gray-700 mb-3">订单明细</h4>
          <div className="space-y-3">
            {group.orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const StatusIcon = statusInfo.icon;
              const actions = getAvailableActions(order.status);
              const isExpanded = expandedOrder === order.id;
              const isLoading = actionLoading === order.id;
              const displayName = getOrderDisplayName(order);

              return (
                <div
                  key={order.id}
                  className="rounded-[16px] bg-white border border-gray-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <button
                    className="w-full px-4 py-3.5 text-left"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.bg} ${statusInfo.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </div>
                        <h5 className="text-[13px] font-semibold text-gray-900 truncate">
                          {displayName}
                        </h5>
                        {order.merchantName && order.title !== order.merchantName && (
                          <p className="text-[13px] text-gray-400 mt-0.5 truncate">{order.title}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[15px] font-bold text-gray-900">¥{order.amount}</span>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && actions.length > 0 && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-50">
                      <div className="flex items-center gap-2 justify-end">
                        {isLoading ? (
                          <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-[13px]">处理中...</span>
                          </div>
                        ) : (
                          <>
                            {actions.includes('cancel') && onCancel && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCancel(order.id);
                                }}
                                className="rounded-full px-4 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 active:bg-gray-200"
                              >
                                取消订单
                              </button>
                            )}
                            {actions.includes('refund') && onRefund && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRefund(order.id);
                                }}
                                className="rounded-full px-4 py-2 text-[13px] font-medium text-orange-600 bg-orange-50 active:bg-orange-100"
                              >
                                申请退款
                              </button>
                            )}
                            {actions.includes('delete') && onDelete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(order.id);
                                }}
                                className="rounded-full px-4 py-2 text-[13px] font-medium text-red-600 bg-red-50 active:bg-red-100"
                              >
                                删除
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-8">
          <h4 className="text-[13px] font-semibold text-gray-700 mb-3">订单信息</h4>
          <div className="rounded-[16px] bg-[#F7F8FA] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">订单编号</span>
              <span className="text-[13px] text-gray-700 font-mono">{group.planId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">创建时间</span>
              <span className="text-[13px] text-gray-700">{dateStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">支付方式</span>
              <span className="text-[13px] text-gray-700">在线支付</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
