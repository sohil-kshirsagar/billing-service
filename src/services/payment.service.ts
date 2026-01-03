import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { stripeClient } from '../integrations/stripe/stripe.client';
import { PaymentRepository } from '../repositories/payment.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { Payment, PaymentStatus, PaymentMethodType, Currency, Refund, RefundReason, RefundStatus } from '../types/billing';
import { PaginationParams, PaginatedResponse, DateRange } from '../types/common';

export interface CreatePaymentInput {
  customerId: string;
  invoiceId?: string;
  amount: number;
  currency: Currency;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  captureMethod?: 'automatic' | 'manual';
  confirm?: boolean;
}

export interface RefundInput {
  paymentId: string;
  amount?: number;
  reason: RefundReason;
  metadata?: Record<string, unknown>;
}

export class PaymentService {
  private paymentRepository: PaymentRepository;
  private customerRepository: CustomerRepository;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.paymentRepository = new PaymentRepository();
    this.customerRepository = new CustomerRepository();
    this.invoiceRepository = new InvoiceRepository();
  }

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    try {
      logger.info('Creating payment', { customerId: input.customerId, amount: input.amount });

      const customer = await this.customerRepository.findById(input.customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${input.customerId}`);
      }

      let stripePaymentIntentId: string | undefined;
      let status: PaymentStatus = 'pending';

      if (customer.stripeCustomerId) {
        const paymentIntent = await stripeClient.createPaymentIntent({
          amount: Math.round(input.amount * 100),
          currency: input.currency.toLowerCase(),
          customer: customer.stripeCustomerId,
          payment_method: input.paymentMethodId,
          confirm: input.confirm ?? true,
          off_session: true,
          description: input.description,
          metadata: input.metadata as Record<string, string>,
          capture_method: input.captureMethod || 'automatic',
        });

        stripePaymentIntentId = paymentIntent.id;
        status = this.mapStripePaymentStatus(paymentIntent.status);
      }

      const payment: Payment = {
        id: uuidv4(),
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        stripePaymentIntentId,
        amount: input.amount,
        currency: input.currency,
        status,
        paymentMethod: 'card',
        refundedAmount: 0,
        metadata: input.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await this.paymentRepository.create(payment);

      if (input.invoiceId && status === 'succeeded') {
        await this.updateInvoicePayment(input.invoiceId, input.amount);
      }

      logger.info('Payment created successfully', { paymentId: created.id, status });
      return created;
    } catch (error) {
      logger.error('Failed to create payment', { error, input });
      throw error;
    }
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    try {
      return await this.paymentRepository.findById(paymentId);
    } catch (error) {
      logger.error('Failed to get payment', { error, paymentId });
      throw error;
    }
  }

  async confirmPayment(paymentId: string, paymentMethodId?: string): Promise<Payment> {
    try {
      logger.info('Confirming payment', { paymentId });

      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      if (payment.status !== 'pending' && payment.status !== 'processing') {
        throw new Error('Payment cannot be confirmed in its current state');
      }

      if (payment.stripePaymentIntentId) {
        const paymentIntent = await stripeClient.confirmPaymentIntent(
          payment.stripePaymentIntentId,
          paymentMethodId
        );

        const status = this.mapStripePaymentStatus(paymentIntent.status);
        const updated = await this.paymentRepository.update(paymentId, {
          status,
          updatedAt: new Date(),
        });

        if (status === 'succeeded' && payment.invoiceId) {
          await this.updateInvoicePayment(payment.invoiceId, payment.amount);
        }

        logger.info('Payment confirmed successfully', { paymentId, status });
        return updated!;
      }

      throw new Error('No Stripe payment intent associated with this payment');
    } catch (error) {
      logger.error('Failed to confirm payment', { error, paymentId });
      throw error;
    }
  }

  async capturePayment(paymentId: string, amount?: number): Promise<Payment> {
    try {
      logger.info('Capturing payment', { paymentId, amount });

      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      if (!payment.stripePaymentIntentId) {
        throw new Error('No Stripe payment intent associated with this payment');
      }

      const amountToCapture = amount ? Math.round(amount * 100) : undefined;
      const paymentIntent = await stripeClient.capturePaymentIntent(
        payment.stripePaymentIntentId,
        amountToCapture
      );

      const capturedAmount = amount || payment.amount;
      const updated = await this.paymentRepository.update(paymentId, {
        status: 'succeeded',
        amount: capturedAmount,
        updatedAt: new Date(),
      });

      if (payment.invoiceId) {
        await this.updateInvoicePayment(payment.invoiceId, capturedAmount);
      }

      logger.info('Payment captured successfully', { paymentId, amount: capturedAmount });
      return updated!;
    } catch (error) {
      logger.error('Failed to capture payment', { error, paymentId });
      throw error;
    }
  }

  async cancelPayment(paymentId: string): Promise<Payment> {
    try {
      logger.info('Canceling payment', { paymentId });

      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      if (payment.status === 'succeeded') {
        throw new Error('Cannot cancel a succeeded payment, use refund instead');
      }

      if (payment.stripePaymentIntentId) {
        await stripeClient.cancelPaymentIntent(payment.stripePaymentIntentId);
      }

      const updated = await this.paymentRepository.update(paymentId, {
        status: 'canceled',
        updatedAt: new Date(),
      });

      logger.info('Payment canceled successfully', { paymentId });
      return updated!;
    } catch (error) {
      logger.error('Failed to cancel payment', { error, paymentId });
      throw error;
    }
  }

  async refundPayment(input: RefundInput): Promise<Refund> {
    try {
      logger.info('Creating refund', { paymentId: input.paymentId, amount: input.amount });

      const payment = await this.paymentRepository.findById(input.paymentId);
      if (!payment) {
        throw new Error(`Payment not found: ${input.paymentId}`);
      }

      if (payment.status !== 'succeeded') {
        throw new Error('Can only refund succeeded payments');
      }

      const refundAmount = input.amount || payment.amount - payment.refundedAmount;
      if (refundAmount > payment.amount - payment.refundedAmount) {
        throw new Error('Refund amount exceeds available amount');
      }

      let stripeRefundId: string | undefined;
      if (payment.stripePaymentIntentId) {
        const stripeRefund = await stripeClient.createRefund({
          payment_intent: payment.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
          reason: input.reason,
          metadata: input.metadata as Record<string, string>,
        });
        stripeRefundId = stripeRefund.id;
      }

      const refund: Refund = {
        id: uuidv4(),
        paymentId: input.paymentId,
        stripeRefundId,
        amount: refundAmount,
        currency: payment.currency,
        reason: input.reason,
        status: 'succeeded',
        metadata: input.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.paymentRepository.createRefund(refund);

      const newRefundedAmount = payment.refundedAmount + refundAmount;
      const newStatus: PaymentStatus =
        newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';

      await this.paymentRepository.update(input.paymentId, {
        refundedAmount: newRefundedAmount,
        status: newStatus,
        updatedAt: new Date(),
      });

      logger.info('Refund created successfully', { refundId: refund.id, amount: refundAmount });
      return refund;
    } catch (error) {
      logger.error('Failed to create refund', { error, input });
      throw error;
    }
  }

  async listPayments(params: PaginationParams): Promise<PaginatedResponse<Payment>> {
    try {
      return await this.paymentRepository.findAll(params);
    } catch (error) {
      logger.error('Failed to list payments', { error, params });
      throw error;
    }
  }

  async listCustomerPayments(customerId: string, params: PaginationParams): Promise<PaginatedResponse<Payment>> {
    try {
      return await this.paymentRepository.findByCustomerIdPaginated(customerId, params);
    } catch (error) {
      logger.error('Failed to list customer payments', { error, customerId });
      throw error;
    }
  }

  async listPaymentsByStatus(status: PaymentStatus, params: PaginationParams): Promise<PaginatedResponse<Payment>> {
    try {
      return await this.paymentRepository.findByStatusPaginated(status, params);
    } catch (error) {
      logger.error('Failed to list payments by status', { error, status });
      throw error;
    }
  }

  async getPaymentsByDateRange(dateRange: DateRange, params: PaginationParams): Promise<PaginatedResponse<Payment>> {
    try {
      return await this.paymentRepository.findByDateRangePaginated(dateRange, params);
    } catch (error) {
      logger.error('Failed to get payments by date range', { error, dateRange });
      throw error;
    }
  }

  async getRefundsForPayment(paymentId: string): Promise<Refund[]> {
    try {
      return await this.paymentRepository.findRefundsByPaymentId(paymentId);
    } catch (error) {
      logger.error('Failed to get refunds for payment', { error, paymentId });
      throw error;
    }
  }

  async retryFailedPayment(paymentId: string, paymentMethodId?: string): Promise<Payment> {
    try {
      logger.info('Retrying failed payment', { paymentId });

      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      if (payment.status !== 'failed') {
        throw new Error('Can only retry failed payments');
      }

      const customer = await this.customerRepository.findById(payment.customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      const newPaymentIntent = await stripeClient.createPaymentIntent({
        amount: Math.round(payment.amount * 100),
        currency: payment.currency.toLowerCase(),
        customer: customer.stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        metadata: { originalPaymentId: paymentId },
      });

      const updated = await this.paymentRepository.update(paymentId, {
        stripePaymentIntentId: newPaymentIntent.id,
        status: this.mapStripePaymentStatus(newPaymentIntent.status),
        failureCode: undefined,
        failureMessage: undefined,
        updatedAt: new Date(),
      });

      logger.info('Payment retry successful', { paymentId });
      return updated!;
    } catch (error) {
      logger.error('Failed to retry payment', { error, paymentId });
      throw error;
    }
  }

  async getPaymentSummary(customerId: string): Promise<{
    totalPaid: number;
    totalRefunded: number;
    pendingAmount: number;
    failedAmount: number;
    currency: Currency;
  }> {
    try {
      const payments = await this.paymentRepository.findByCustomerId(customerId);

      const summary = payments.reduce(
        (acc, payment) => {
          switch (payment.status) {
            case 'succeeded':
            case 'partially_refunded':
              acc.totalPaid += payment.amount - payment.refundedAmount;
              acc.totalRefunded += payment.refundedAmount;
              break;
            case 'refunded':
              acc.totalRefunded += payment.amount;
              break;
            case 'pending':
            case 'processing':
              acc.pendingAmount += payment.amount;
              break;
            case 'failed':
              acc.failedAmount += payment.amount;
              break;
          }
          return acc;
        },
        { totalPaid: 0, totalRefunded: 0, pendingAmount: 0, failedAmount: 0 }
      );

      return {
        ...summary,
        currency: payments[0]?.currency || 'USD',
      };
    } catch (error) {
      logger.error('Failed to get payment summary', { error, customerId });
      throw error;
    }
  }

  async processWebhookPaymentUpdate(stripePaymentIntentId: string, status: string): Promise<void> {
    try {
      logger.info('Processing webhook payment update', { stripePaymentIntentId, status });

      const payment = await this.paymentRepository.findByStripePaymentIntentId(stripePaymentIntentId);
      if (!payment) {
        logger.warn('Payment not found for webhook update', { stripePaymentIntentId });
        return;
      }

      const newStatus = this.mapStripePaymentStatus(status);
      await this.paymentRepository.update(payment.id, {
        status: newStatus,
        updatedAt: new Date(),
      });

      if (newStatus === 'succeeded' && payment.invoiceId) {
        await this.updateInvoicePayment(payment.invoiceId, payment.amount);
      }

      logger.info('Webhook payment update processed', { paymentId: payment.id, newStatus });
    } catch (error) {
      logger.error('Failed to process webhook payment update', { error, stripePaymentIntentId });
      throw error;
    }
  }

  private mapStripePaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return 'succeeded';
      case 'processing':
        return 'processing';
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending';
      case 'canceled':
        return 'canceled';
      default:
        return 'failed';
    }
  }

  private async updateInvoicePayment(invoiceId: string, amount: number): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) return;

    const newAmountPaid = invoice.amountPaid + amount;
    const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newAmountDue === 0 ? 'paid' : invoice.status;

    await this.invoiceRepository.update(invoiceId, {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date() : undefined,
      updatedAt: new Date(),
    });
  }
}

export const paymentService = new PaymentService();
