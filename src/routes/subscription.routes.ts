import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { subscriptionController } from '../controllers/subscription.controller';

export async function subscriptionRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // CRUD operations
  fastify.post('/', subscriptionController.createSubscription.bind(subscriptionController));
  fastify.get('/', subscriptionController.listSubscriptions.bind(subscriptionController));
  fastify.get('/status/:status', subscriptionController.listSubscriptionsByStatus.bind(subscriptionController));
  fastify.get('/ending-soon', subscriptionController.getSubscriptionsEndingSoon.bind(subscriptionController));
  fastify.get('/trials-ending', subscriptionController.getTrialsEndingSoon.bind(subscriptionController));
  fastify.get('/customer/:customerId', subscriptionController.listCustomerSubscriptions.bind(subscriptionController));
  fastify.get('/:subscriptionId', subscriptionController.getSubscription.bind(subscriptionController));
  fastify.get('/:subscriptionId/with-plan', subscriptionController.getSubscriptionWithPlan.bind(subscriptionController));
  fastify.patch('/:subscriptionId', subscriptionController.updateSubscription.bind(subscriptionController));

  // Subscription lifecycle
  fastify.post('/:subscriptionId/cancel', subscriptionController.cancelSubscription.bind(subscriptionController));
  fastify.post('/:subscriptionId/resume', subscriptionController.resumeSubscription.bind(subscriptionController));
  fastify.post('/:subscriptionId/pause', subscriptionController.pauseSubscription.bind(subscriptionController));
  fastify.post('/:subscriptionId/unpause', subscriptionController.unpauseSubscription.bind(subscriptionController));

  // Plan and quantity changes
  fastify.post('/:subscriptionId/change-plan', subscriptionController.changePlan.bind(subscriptionController));
  fastify.post('/:subscriptionId/update-quantity', subscriptionController.updateQuantity.bind(subscriptionController));

  // Usage
  fastify.post('/:subscriptionId/usage', subscriptionController.recordUsage.bind(subscriptionController));
}
