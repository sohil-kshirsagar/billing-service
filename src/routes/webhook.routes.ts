import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { webhookController } from '../controllers/webhook.controller';

export async function webhookRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Configure raw body parsing for webhook signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = JSON.parse(body as string);
      (req as any).rawBody = body;
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Stripe webhook
  fastify.post('/stripe', webhookController.handleStripeWebhook.bind(webhookController));

  // Ramp webhook
  fastify.post('/ramp', webhookController.handleRampWebhook.bind(webhookController));
}
