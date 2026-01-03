import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService, CreatePaymentInput, RefundInput } from '../services/payment.service';
import { logger } from '../utils/logger';
import { PaymentStatus } from '../types/billing';
import { PaginationParams } from '../types/common';

interface PaymentParams {
  paymentId: string;
}

interface ListQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface DateRangeQuery extends ListQueryParams {
  startDate: string;
  endDate: string;
}

interface ConfirmPaymentBody {
  paymentMethodId?: string;
}

interface CapturePaymentBody {
  amount?: number;
}

export class PaymentController {
  async createPayment(
    request: FastifyRequest<{ Body: CreatePaymentInput }>,
    reply: FastifyReply
  ) {
    try {
      const input = request.body;
      logger.info('Creating payment', { customerId: input.customerId, amount: input.amount });

      const payment = await paymentService.createPayment(input);

      return reply.status(201).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to create payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment' },
      });
    }
  }

  async getPayment(
    request: FastifyRequest<{ Params: PaymentParams }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;
      logger.info('Getting payment', { paymentId });

      const payment = await paymentService.getPaymentById(paymentId);

      if (!payment) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payment not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to get payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to get payment' },
      });
    }
  }

  async confirmPayment(
    request: FastifyRequest<{ Params: PaymentParams; Body: ConfirmPaymentBody }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;
      const { paymentMethodId } = request.body;

      logger.info('Confirming payment', { paymentId });

      const payment = await paymentService.confirmPayment(paymentId, paymentMethodId);

      return reply.status(200).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to confirm payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to confirm payment' },
      });
    }
  }

  async capturePayment(
    request: FastifyRequest<{ Params: PaymentParams; Body: CapturePaymentBody }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;
      const { amount } = request.body;

      logger.info('Capturing payment', { paymentId, amount });

      const payment = await paymentService.capturePayment(paymentId, amount);

      return reply.status(200).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to capture payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to capture payment' },
      });
    }
  }

  async cancelPayment(
    request: FastifyRequest<{ Params: PaymentParams }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;

      logger.info('Canceling payment', { paymentId });

      const payment = await paymentService.cancelPayment(paymentId);

      return reply.status(200).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to cancel payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to cancel payment' },
      });
    }
  }

  async refundPayment(
    request: FastifyRequest<{ Params: PaymentParams; Body: Omit<RefundInput, 'paymentId'> }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;
      const refundData = request.body;

      logger.info('Refunding payment', { paymentId, amount: refundData.amount });

      const refund = await paymentService.refundPayment({ ...refundData, paymentId });

      return reply.status(201).send({
        success: true,
        data: refund,
      });
    } catch (error) {
      logger.error('Failed to refund payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to refund payment' },
      });
    }
  }

  async listPayments(
    request: FastifyRequest<{ Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing payments', { params });

      const result = await paymentService.listPayments(params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list payments', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to list payments' },
      });
    }
  }

  async listCustomerPayments(
    request: FastifyRequest<{ Params: { customerId: string }; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing customer payments', { customerId, params });

      const result = await paymentService.listCustomerPayments(customerId, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list customer payments', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to list customer payments' },
      });
    }
  }

  async listPaymentsByStatus(
    request: FastifyRequest<{ Params: { status: PaymentStatus }; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { status } = request.params;
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing payments by status', { status, params });

      const result = await paymentService.listPaymentsByStatus(status, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list payments by status', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to list payments by status' },
      });
    }
  }

  async getRefunds(
    request: FastifyRequest<{ Params: PaymentParams }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;

      logger.info('Getting refunds for payment', { paymentId });

      const refunds = await paymentService.getRefundsForPayment(paymentId);

      return reply.status(200).send({
        success: true,
        data: refunds,
      });
    } catch (error) {
      logger.error('Failed to get refunds', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to get refunds' },
      });
    }
  }

  async retryPayment(
    request: FastifyRequest<{ Params: PaymentParams; Body: { paymentMethodId?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentId } = request.params;
      const { paymentMethodId } = request.body;

      logger.info('Retrying payment', { paymentId });

      const payment = await paymentService.retryFailedPayment(paymentId, paymentMethodId);

      return reply.status(200).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to retry payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to retry payment' },
      });
    }
  }

  async getPaymentSummary(
    request: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;

      logger.info('Getting payment summary', { customerId });

      const summary = await paymentService.getPaymentSummary(customerId);

      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get payment summary', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: 'Failed to get payment summary' },
      });
    }
  }
}

export const paymentController = new PaymentController();
