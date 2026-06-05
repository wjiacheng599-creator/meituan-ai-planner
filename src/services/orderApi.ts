/**
 * Order API - 前端订单接口服务
 *
 * 封装对 /api/orders 端点的 HTTP 请求
 */

import { apiUrl } from './apiBase';

export interface OrderData {
  id: string;
  userId: string;
  planId: string;
  activityIds: string;
  title: string;
  merchantName: string;
  amount: number;
  status: string;
  paymentId: string;
  createdAt: number;
  updatedAt: number;
  canceledAt?: number;
  refundReason?: string;
  refundStatus?: string;
}

interface OrdersResponse {
  orders: OrderData[];
  total?: number;
}

interface OrderResponse {
  order: OrderData;
}

interface OrderActionResponse {
  success: boolean;
  order: OrderData;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'UNKNOWN_ERROR', message: 'UNKNOWN_ERROR' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 创建订单（支付后调用）
 */
export async function createOrder(params: {
  planId: string;
  activityIds: string[];
  title: string;
  merchantName: string;
  amount: number;
  paymentId: string;
}): Promise<OrderData> {
  const result = await apiRequest<OrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result.order;
}

/**
 * 获取用户订单列表
 */
export async function getOrders(status?: string): Promise<OrdersResponse> {
  const url = status ? `/api/orders?status=${encodeURIComponent(status)}` : '/api/orders';
  return apiRequest<OrdersResponse>(url);
}

/**
 * 获取单个订单详情
 */
export async function getOrderDetail(orderId: string): Promise<OrderData> {
  const result = await apiRequest<OrderResponse>(`/api/orders/${encodeURIComponent(orderId)}`);
  return result.order;
}

/**
 * 取消订单
 */
export async function cancelOrder(orderId: string): Promise<OrderData> {
  const result = await apiRequest<OrderActionResponse>(
    `/api/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
    },
  );
  return result.order;
}

/**
 * 申请退款
 */
export async function requestRefund(orderId: string, reason: string): Promise<OrderData> {
  const result = await apiRequest<OrderActionResponse>(
    `/api/orders/${encodeURIComponent(orderId)}/refund`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
  return result.order;
}

/**
 * 删除订单
 */
export async function deleteOrder(orderId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });
}
