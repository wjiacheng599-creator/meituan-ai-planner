/**
 * Order API - 前端订单接口服务
 *
 * 封装对 /api/orders 端点的 HTTP 请求
 */

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
  total: number;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
    throw new Error(error.error || `HTTP ${response.status}`);
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
  return apiRequest<OrderData>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(params),
  });
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
  return apiRequest<OrderData>(`/api/orders/${encodeURIComponent(orderId)}`);
}

/**
 * 取消订单
 */
export async function cancelOrder(orderId: string): Promise<OrderData> {
  return apiRequest<OrderData>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
  });
}

/**
 * 申请退款
 */
export async function requestRefund(orderId: string, reason: string): Promise<OrderData> {
  return apiRequest<OrderData>(`/api/orders/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * 删除订单
 */
export async function deleteOrder(orderId: string): Promise<void> {
  await apiRequest<void>(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });
}
