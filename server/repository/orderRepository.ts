/**
 * OrderRepository - 订单数据访问层
 * 
 * 实现订单的CRUD操作
 */

import type { OrderRow, OrderStatus, RefundStatus } from './types';

export class OrderRepository {
  constructor(private ctx: any) {}
  
  /**
   * 创建订单
   */
  createOrder(order: Omit<OrderRow, 'id' | 'createdAt' | 'updatedAt'>): OrderRow {
    const now = Date.now();
    const newOrder: OrderRow = {
      ...order,
      id: `order_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      refundStatus: 'none',
    };
    
    this.ctx.runInTransaction(() => {
      this.ctx.db.prepare(`
        INSERT INTO orders (id, userId, planId, activityIds, title, merchantName, amount, status, paymentId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newOrder.id,
        newOrder.userId,
        newOrder.planId,
        newOrder.activityIds,
        newOrder.title,
        newOrder.merchantName,
        newOrder.amount,
        newOrder.status,
        newOrder.paymentId,
        newOrder.createdAt,
        newOrder.updatedAt
      );
    });
    
    return newOrder;
  }
  
  /**
   * 根据ID获取订单
   */
  getOrderById(id: string): OrderRow | null {
    const row = this.ctx.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
    return row || null;
  }
  
  /**
   * 根据用户ID获取订单列表
   */
  getOrdersByUserId(userId: string, status?: OrderStatus): OrderRow[] {
    let query = 'SELECT * FROM orders WHERE userId = ?';
    const params: any[] = [userId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC';
    return this.ctx.db.prepare(query).all(...params) as OrderRow[];
  }
  
  /**
   * 根据行程ID获取订单列表
   */
  getOrdersByPlanId(planId: string): OrderRow[] {
    return this.ctx.db.prepare('SELECT * FROM orders WHERE planId = ? ORDER BY createdAt DESC').all(planId) as OrderRow[];
  }
  
  /**
   * 更新订单状态
   */
  updateOrderStatus(id: string, status: OrderStatus): void {
    this.ctx.runInTransaction(() => {
      this.ctx.db.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?')
        .run(status, Date.now(), id);
    });
  }
  
  /**
   * 更新订单退款状态
   */
  updateOrderRefund(id: string, refundStatus: RefundStatus, reason?: string): void {
    this.ctx.runInTransaction(() => {
      this.ctx.db.prepare('UPDATE orders SET refundStatus = ?, refundReason = ?, updatedAt = ? WHERE id = ?')
        .run(refundStatus, reason || null, Date.now(), id);
    });
  }
  
  /**
   * 取消订单
   */
  cancelOrder(id: string): void {
    this.ctx.runInTransaction(() => {
      this.ctx.db.prepare('UPDATE orders SET status = ?, canceledAt = ?, updatedAt = ? WHERE id = ?')
        .run('canceled', Date.now(), Date.now(), id);
    });
  }
  
  /**
   * 删除订单
   */
  deleteOrder(id: string): void {
    this.ctx.runInTransaction(() => {
      this.ctx.db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    });
  }
}
