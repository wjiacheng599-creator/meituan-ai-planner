/**
 * PaymentService
 *
 * Business logic for payment processing.
 * Uses ServerRepository interface (extracted from server/index.ts — payment endpoints)
 */
import type { ServerRepository } from '../repository/types';

export interface ProcessPaymentParams {
  userId: string;
  amount: number;
  method: string;
  orderTitle?: string;
}

export class PaymentService {
  constructor(private repository: ServerRepository) {}

  async processPayment(params: ProcessPaymentParams) {
    const { userId, amount, method, orderTitle = 'Order' } = params;

    // Validate payment method
    const validMethods = ['meituan', 'wechat', 'alipay'];
    if (!validMethods.includes(method)) {
      throw new PaymentValidationError('Invalid payment method', 'INVALID_METHOD');
    }

    // Generate transaction ID
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Simulate payment processing delay (500ms-1500ms)
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Save payment record via repository
    const paymentRecord = await this.repository.savePaymentRecord({
      userId,
      transactionId,
      amount,
      method: method as 'meituan' | 'wechat' | 'alipay',
      orderTitle,
      status: 'completed',
    });

    return paymentRecord;
  }

  async getPaymentByTransactionId(transactionId: string, userId: string) {
    const record = await this.repository.getPaymentByTransactionId(transactionId);
    if (!record || record.userId !== userId) {
      return null;
    }
    return record;
  }
}

export class PaymentValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}
