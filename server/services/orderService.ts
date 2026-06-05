/**
 * OrderService - 订单业务逻辑层
 * 
 * 处理订单的创建、取消、退款等业务逻辑
 */

import type { ServerRepository } from '../repository/types';
import type { OrderRow, OrderStatus, RefundStatus } from '../repository/types';

export class OrderService {
  constructor(private repository: ServerRepository) {}
  
  /**
   * 创建订单（支付成功后自动创建）
   */
  async createOrderFromPayment(payment: any, plan: any): Promise<OrderRow> {
    const order = {
      userId: payment.userId,
      planId: plan.id,
      activityIds: JSON.stringify(plan.activities.map((a: any) => a.id)),
      title: plan.title,
      merchantName: plan.merchantName || plan.activities[0]?.title || '未知商家',
      amount: payment.amount,
      status: 'paid' as OrderStatus,
      paymentId: payment.id,
    };
    
    return await this.repository.createOrder(order);
  }

  async createOrderFromExecution(params: {
    userId: string;
    planId: string;
    activityIds: string[];
    title: string;
    merchantName: string;
    amount: number;
  }): Promise<OrderRow> {
    const order = {
      userId: params.userId,
      planId: params.planId,
      activityIds: JSON.stringify(params.activityIds),
      title: params.title,
      merchantName: params.merchantName,
      amount: params.amount,
      status: 'paid' as OrderStatus,
      paymentId: `exec_${params.planId}_${Date.now()}`,
    };
    return await this.repository.createOrder(order);
  }
  
  /**
   * 取消订单
   */
  async cancelOrder(orderId: string, userId: string): Promise<OrderRow> {
    const order = await this.repository.getOrderById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.userId !== userId) throw new Error('UNAUTHORIZED');
    if (order.status !== 'pending' && order.status !== 'paid') {
      throw new Error('INVALID_STATUS_FOR_CANCEL');
    }
    
    // 如果已支付，需要退款
    if (order.status === 'paid') {
      // 调用支付服务退款（模拟）
      // await paymentService.refund(order.paymentId);
      await this.repository.updateOrderStatus(orderId, 'refunding');
      await this.repository.updateOrderRefund(orderId, 'requested', '用户取消订单');
    } else {
      await this.repository.cancelOrder(orderId);
    }
    
    return (await this.repository.getOrderById(orderId))!;
  }
  
  /**
   * 申请退款
   */
  async requestRefund(orderId: string, userId: string, reason: string): Promise<OrderRow> {
    const order = await this.repository.getOrderById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.userId !== userId) throw new Error('UNAUTHORIZED');
    if (order.status !== 'paid' && order.status !== 'in_progress') {
      throw new Error('INVALID_STATUS_FOR_REFUND');
    }
    
    await this.repository.updateOrderStatus(orderId, 'refunding');
    await this.repository.updateOrderRefund(orderId, 'requested', reason);
    
    return (await this.repository.getOrderById(orderId))!;
  }
  
  /**
   * 查询用户订单
   */
  async getUserOrders(userId: string, status?: OrderStatus): Promise<OrderRow[]> {
    return await this.repository.getOrdersByUserId(userId, status);
  }
  
  /**
   * 查询订单详情
   */
  async getOrderDetail(orderId: string, userId: string): Promise<OrderRow | null> {
    const order = await this.repository.getOrderById(orderId);
    if (!order || order.userId !== userId) return null;
    return order;
  }

  /**
   * 删除订单
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    const order = await this.repository.getOrderById(orderId);
    if (!order) return false;
    await this.repository.deleteOrder(orderId);
    return true;
  }
}
