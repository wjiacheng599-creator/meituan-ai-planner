import { ChevronRight, Clock, Package, CheckCircle2, XCircle } from 'lucide-react';
import type { Order } from '../../types';

export interface TripOrderGroup {
  planId: string;
  title: string;
  orders: Order[];
  totalAmount: number;
  createdAt: number;
  status: 'completed' | 'paid' | 'pending' | 'canceled' | 'mixed';
}

function getGroupStatus(orders: Order[]): TripOrderGroup['status'] {
  const statuses = new Set(orders.map((o) => o.status));
  if (statuses.size === 1) return orders[0].status as TripOrderGroup['status'];
  if (statuses.has('paid') || statuses.has('completed')) return 'paid';
  if (statuses.has('canceled')) return 'canceled';
  return 'mixed';
}

function getStatusInfo(status: TripOrderGroup['status']) {
  switch (status) {
    case 'completed':
      return { label: '已完成', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
    case 'paid':
      return { label: '已支付', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 };
    case 'pending':
      return { label: '待支付', color: 'bg-amber-100 text-amber-700', icon: Clock };
    case 'canceled':
      return { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle };
    case 'mixed':
      return { label: '部分完成', color: 'bg-purple-100 text-purple-700', icon: Package };
    default:
      return { label: '未知', color: 'bg-gray-100 text-gray-500', icon: Package };
  }
}

function getOrderDisplayName(order: Order): string {
  if (order.merchantName) return order.merchantName;
  const title = order.title || '';
  const dashIndex = title.indexOf(' - ');
  if (dashIndex > 0) return title.substring(dashIndex + 3);
  return title;
}

export function groupOrdersByTrip(orders: Order[]): TripOrderGroup[] {
  const groups = new Map<string, Order[]>();

  for (const order of orders) {
    const key = order.planId || order.id;
    const existing = groups.get(key) || [];
    existing.push(order);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([planId, orders]) => {
      const totalAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
      const createdAt = Math.max(...orders.map((o) => o.createdAt || 0));
      const title = orders[0]?.title?.split(' - ')[0] || '行程订单';
      const status = getGroupStatus(orders);

      return { planId, title, orders, totalAmount, createdAt, status };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

interface TripOrderCardProps {
  group: TripOrderGroup;
  onClick?: (group: TripOrderGroup) => void;
}

export default function TripOrderCard({ group, onClick }: TripOrderCardProps) {
  const statusInfo = getStatusInfo(group.status);
  const StatusIcon = statusInfo.icon;
  const orderCount = group.orders.length;
  const date = new Date(group.createdAt);
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

  return (
    <button
      className="w-full rounded-[24px] bg-white border border-gray-100 p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform duration-150"
      onClick={() => onClick?.(group)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-gray-900 truncate">{group.title}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {dateStr}
            </span>
            <span className="text-[11px] text-gray-400">·</span>
            <span className="text-[11px] text-gray-400">{orderCount} 个订单</span>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusInfo.color}`}
        >
          <StatusIcon className="w-3 h-3" />
          {statusInfo.label}
        </span>
      </div>

      <div className="rounded-[14px] bg-[#F7F8FA] px-3.5 py-3 mb-3">
        <div className="space-y-2">
          {group.orders.slice(0, 3).map((order) => (
            <div key={order.id} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
              <span className="text-[13px] text-gray-700 truncate flex-1">
                {getOrderDisplayName(order)}
              </span>
              <span className="text-[13px] text-gray-500 shrink-0">¥{order.amount}</span>
            </div>
          ))}
          {orderCount > 3 && (
            <div className="text-[11px] text-gray-400 pl-3.5">还有 {orderCount - 3} 个订单...</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[13px] text-gray-400">合计</span>
          <span className="text-[18px] font-bold text-gray-900 ml-1.5">¥{group.totalAmount}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </button>
  );
}
