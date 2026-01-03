import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { paymentController } from '../controllers/payment.controller';

export async function paymentRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // CRUD operations
  fastify.post('/', paymentController.createPayment.bind(paymentController));
  fastify.get('/', paymentController.listPayments.bind(paymentController));
  fastify.get('/status/:status', paymentController.listPaymentsByStatus.bind(paymentController));
  fastify.get('/customer/:customerId', paymentController.listCustomerPayments.bind(paymentController));
  fastify.get('/customer/:customerId/summary', paymentController.getPaymentSummary.bind(paymentController));
  fastify.get('/:paymentId', paymentController.getPayment.bind(paymentController));

  // Payment lifecycle
  fastify.post('/:paymentId/confirm', paymentController.confirmPayment.bind(paymentController));
  fastify.post('/:paymentId/capture', paymentController.capturePayment.bind(paymentController));
  fastify.post('/:paymentId/cancel', paymentController.cancelPayment.bind(paymentController));
  fastify.post('/:paymentId/retry', paymentController.retryPayment.bind(paymentController));

  // Refunds
  fastify.post('/:paymentId/refund', paymentController.refundPayment.bind(paymentController));
  fastify.get('/:paymentId/refunds', paymentController.getRefunds.bind(paymentController));
}
