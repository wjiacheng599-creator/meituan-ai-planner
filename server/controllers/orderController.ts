/**
 * orderController - 订单API控制器
 * 
 * 处理订单相关的HTTP请求
 */

import type { Request, Response } from 'express';
import type { OrderService } from '../services/orderService';

export function createOrderController(orderService: OrderService) {
  return {
    /**
     * 创建订单（支付成功后调用）
     */
    async createOrder(req: Request, res: Response) {
      try {
        const user = (req as any).user;
        if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { planId, activityIds, title, merchantName, amount, paymentId } = req.body;
        
        if (!planId || !title || !amount) {
          res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS' });
          return;
        }

        let order;
        if (paymentId) {
          order = await orderService.createOrderFromPayment(
            { userId: user.id, id: paymentId, amount },
            {
              id: planId,
              title,
              activities: (activityIds || []).map((id: string, index: number) => ({
                id,
                title: index === 0 ? merchantName : undefined,
              })),
              merchantName,
            }
          );
        } else {
          order = await orderService.createOrderFromExecution({
            userId: user.id,
            planId,
            activityIds: activityIds || [],
            title,
            merchantName: merchantName || title,
            amount,
          });
        }
        
        res.status(201).json({ order });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'CREATE_ORDER_FAILED' });
      }
    },

    /**
     * 获取用户订单列表
     */
    async getOrders(req: Request, res: Response) {
      try {
        const user = (req as any).user; // 从auth中间件获取
        if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
        
        const status = req.query.status as any || undefined;
        const orders = await orderService.getUserOrders(user.id, status);
        res.json({ orders });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'GET_ORDERS_FAILED' });
      }
    },

    /**
     * 获取订单详情
     */
    async getOrderDetail(req: Request, res: Response) {
      try {
        const user = (req as any).user;
        if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
        
        const orderId = req.params.id;
        const order = await orderService.getOrderDetail(orderId, user.id);
        
        if (!order) {
          res.status(404).json({ error: 'ORDER_NOT_FOUND' });
          return;
        }
        
        res.json({ order });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'GET_ORDER_FAILED' });
      }
    },

    /**
     * 取消订单
     */
    async cancelOrder(req: Request, res: Response) {
      try {
        const user = (req as any).user;
        if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
        
        const orderId = req.params.id;
        const order = await orderService.cancelOrder(orderId, user.id);
        res.json({ success: true, order });
      } catch (error: any) {
        const status = error.message === 'ORDER_NOT_FOUND' ? 404 :
                     error.message === 'UNAUTHORIZED' ? 401 : 400;
        res.status(status).json({ error: error.message || 'CANCEL_FAILED' });
      }
    },

    /**
     * 申请退款
     */
    async requestRefund(req: Request, res: Response) {
      try {
        const user = (req as any).user;
        if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
        
        const orderId = req.params.id;
        const { reason } = req.body;
        
        if (!reason) {
          res.status(400).json({ error: 'REFUND_REASON_REQUIRED' });
          return;
        }
        
        const order = await orderService.requestRefund(orderId, user.id, reason);
        res.json({ success: true, order });
      } catch (error: any) {
        const status = error.message === 'ORDER_NOT_FOUND' ? 404 :
                     error.message === 'UNAUTHORIZED' ? 401 : 400;
        res.status(status).json({ error: error.message || 'REFUND_FAILED' });
      }
    },

    /**
     * 删除订单（可选）
     */
    async deleteOrder(req: Request, res: Response) {
      try {
        const user = (req as any).user;
        if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
        
        const orderId = req.params.id;
        // 检查权限
        const order = await orderService.getOrderDetail(orderId, user.id);
        if (!order) { res.status(404).json({ error: 'ORDER_NOT_FOUND' }); return; }
        
        // 只有已完成/已取消/已退款的订单可以删除
        if (!['completed', 'canceled', 'refunded'].includes(order.status)) {
          res.status(400).json({ error: 'INVALID_STATUS_FOR_DELETE' });
          return;
        }
        
        // 调用 repository 真正删除
        const deleted = await orderService.deleteOrder(orderId);
        if (!deleted) {
          res.status(404).json({ error: 'ORDER_NOT_FOUND' });
          return;
        }
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'DELETE_FAILED' });
      }
    },
  };
}
