import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { getOrders, cancelOrder, requestRefund, deleteOrder } from '../services/orderApi';
import type { OrderData } from '../services/orderApi';
import type { Order, OrderStatus } from '../types';

function convertOrderData(data: OrderData): Order {
  return {
    id: data.id,
    planId: data.planId,
    activityIds: data.activityIds,
    title: data.title,
    merchantName: data.merchantName,
    amount: data.amount,
    status: (data.status as OrderStatus) || 'pending',
    paymentId: data.paymentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    canceledAt: data.canceledAt,
    refundReason: data.refundReason,
    refundStatus: data.refundStatus,
  };
}

export function useOrders() {
  const { orders, setOrders } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOrders();
      const serverOrders = (result.orders || []).map(convertOrderData);
      setOrders(serverOrders);
    } catch (err) {
      console.error('[useOrders] Failed to fetch orders:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [setOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      setActionLoading(orderId);
      try {
        await cancelOrder(orderId);
        await fetchOrders();
      } catch (err) {
        console.error('[useOrders] Cancel failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchOrders]
  );

  const handleRefundOrder = useCallback(
    async (orderId: string) => {
      setActionLoading(orderId);
      try {
        await requestRefund(orderId, '用户申请退款');
        await fetchOrders();
      } catch (err) {
        console.error('[useOrders] Refund failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchOrders]
  );

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      setActionLoading(orderId);
      try {
        await deleteOrder(orderId);
        await fetchOrders();
      } catch (err) {
        console.error('[useOrders] Delete failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchOrders]
  );

  return {
    orders,
    loading,
    error,
    actionLoading,
    fetchOrders,
    handleCancelOrder,
    handleRefundOrder,
    handleDeleteOrder,
  };
}
