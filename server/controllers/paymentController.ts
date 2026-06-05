/**
 * PaymentController
 *
 * HTTP layer for payment endpoints.
 * Delegates business logic to PaymentService.
 */
import type { Request, Response } from 'express';
import { PaymentService, PaymentValidationError } from '../services/paymentService';
import type { OrderService } from '../services/orderService';
import { resolveUser } from '../middleware/auth';

export function createPaymentController(paymentService: PaymentService, orderService?: OrderService) {
  async function processPayment(req: Request, res: Response) {
    try {
      const user = await resolveUser(req, res);
      if (!user) {
        res.status(401).json({ success: false, message: 'UNAUTHORIZED' });
        return;
      }

      const { amount, method, orderTitle } = req.body || {};

      // Validate required fields
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          message: '金额无效',
          code: 'INVALID_AMOUNT',
        });
        return;
      }

      const validMethods = ['meituan', 'wechat', 'alipay'];
      if (!validMethods.includes(method)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment method',
          code: 'INVALID_METHOD',
        });
        return;
      }

      const result = await paymentService.processPayment({
        userId: user.id,
        amount,
        method,
        orderTitle,
      });

      let orderId: string | undefined;
      const { planId, activityIds, merchantName } = req.body || {};
      if (orderService && planId && result.id) {
        try {
          const order = await orderService.createOrderFromPayment(
            { userId: user.id, id: result.id, amount },
            {
              id: planId,
              title: orderTitle || '美团订单',
              activities: (activityIds || []).map((id: string, index: number) => ({
                id,
                title: index === 0 ? (merchantName || '未知商家') : undefined,
              })),
              merchantName: merchantName || '未知商家',
            },
          );
          orderId = order.id;
        } catch (orderErr) {
          console.error('[payment] Order creation after payment failed:', orderErr);
        }
      }

      res.json({
        success: true,
        transactionId: result.transactionId,
        message: '支付成功',
        paymentId: result.id,
        orderId,
      });
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        res.status(400).json({ success: false, message: error.message, code: error.code });
        return;
      }
      console.error('[payment] processing failed:', error);
      res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        code: 'PAYMENT_FAILED',
      });
    }
  }

  async function getPayment(req: Request, res: Response) {
    try {
      const user = await resolveUser(req, res);
      if (!user) {
        res.status(401).json({ success: false, message: 'UNAUTHORIZED' });
        return;
      }

      const transaction = await paymentService.getPaymentByTransactionId(
        req.params.transactionId,
        user.id,
      );

      if (!transaction) {
        res.status(404).json({ success: false, message: 'Transaction not found' });
        return;
      }

      res.json({ success: true, transaction });
    } catch (error) {
      console.error('[payment] get failed:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve payment' });
    }
  }

  return { processPayment, getPayment };
}
