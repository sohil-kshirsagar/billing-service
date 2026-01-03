import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { billingController } from '../controllers/billing.controller';

export async function billingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Overview and metrics
  fastify.get('/overview', billingController.getOverview.bind(billingController));
  fastify.get('/revenue-breakdown', billingController.getRevenueBreakdown.bind(billingController));
  fastify.get('/metrics', billingController.getMetrics.bind(billingController));

  // Reports
  fastify.get('/report', billingController.generateReport.bind(billingController));

  // Billing operations
  fastify.post('/subscriptions/:subscriptionId/process-billing', billingController.processEndOfPeriodBilling.bind(billingController));
  fastify.get('/subscriptions/:subscriptionId/proration', billingController.calculateProration.bind(billingController));

  // Sync operations
  fastify.post('/customers/:customerId/sync/stripe', billingController.syncWithStripe.bind(billingController));
  fastify.post('/customers/:customerId/businesses/:businessId/sync/ramp', billingController.syncWithRamp.bind(billingController));

  // Payment operations
  fastify.post('/invoices/:invoiceId/retry-payment', billingController.retryFailedPayment.bind(billingController));
  fastify.post('/customers/:customerId/invoices/:invoiceId/apply-credits', billingController.applyCredits.bind(billingController));
}
