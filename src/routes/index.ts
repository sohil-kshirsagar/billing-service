import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { rampRoutes } from './ramp.routes';
import { billingRoutes } from './billing.routes';
import { customerRoutes } from './customer.routes';
import { invoiceRoutes } from './invoice.routes';
import { paymentRoutes } from './payment.routes';
import { subscriptionRoutes } from './subscription.routes';
import { webhookRoutes } from './webhook.routes';

export async function registerRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // API v1 routes
  fastify.register(async (api) => {
    api.register(rampRoutes, { prefix: '/ramp' });
    api.register(billingRoutes, { prefix: '/billing' });
    api.register(customerRoutes, { prefix: '/customers' });
    api.register(invoiceRoutes, { prefix: '/invoices' });
    api.register(paymentRoutes, { prefix: '/payments' });
    api.register(subscriptionRoutes, { prefix: '/subscriptions' });
  }, { prefix: '/api/v1' });

  // Webhooks (no prefix)
  fastify.register(webhookRoutes, { prefix: '/webhooks' });

  // Health check
  fastify.get('/health', async (request, reply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Ready check
  fastify.get('/ready', async (request, reply) => {
    return reply.status(200).send({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });
}
