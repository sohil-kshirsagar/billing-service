import { FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionService, CreateSubscriptionInput, UpdateSubscriptionInput } from '../services/subscription.service';
import { logger } from '../utils/logger';
import { SubscriptionStatus } from '../types/billing';
import { PaginationParams } from '../types/common';

interface SubscriptionParams {
  subscriptionId: string;
}

interface ListQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ChangePlanBody {
  planId: string;
  prorate?: boolean;
}

interface UpdateQuantityBody {
  quantity: number;
  prorate?: boolean;
}

interface RecordUsageBody {
  quantity: number;
  action?: 'increment' | 'set';
}

interface PauseSubscriptionBody {
  behavior?: 'keep_as_draft' | 'mark_uncollectible' | 'void';
  resumesAt?: string;
}

export class SubscriptionController {
  async createSubscription(
    request: FastifyRequest<{ Body: CreateSubscriptionInput }>,
    reply: FastifyReply
  ) {
    try {
      const input = request.body;
      logger.info('Creating subscription', { customerId: input.customerId, planId: input.planId });

      const subscription = await subscriptionService.createSubscription(input);

      return reply.status(201).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to create subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to create subscription' },
      });
    }
  }

  async getSubscription(
    request: FastifyRequest<{ Params: SubscriptionParams }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      logger.info('Getting subscription', { subscriptionId });

      const subscription = await subscriptionService.getSubscriptionById(subscriptionId);

      if (!subscription) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subscription not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to get subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to get subscription' },
      });
    }
  }

  async updateSubscription(
    request: FastifyRequest<{ Params: SubscriptionParams; Body: UpdateSubscriptionInput }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const input = request.body;

      logger.info('Updating subscription', { subscriptionId });

      const subscription = await subscriptionService.updateSubscription(subscriptionId, input);

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to update subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to update subscription' },
      });
    }
  }

  async cancelSubscription(
    request: FastifyRequest<{ Params: SubscriptionParams; Querystring: { immediate?: boolean } }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const { immediate } = request.query;

      logger.info('Canceling subscription', { subscriptionId, immediate });

      const subscription = await subscriptionService.cancelSubscription(subscriptionId, immediate);

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to cancel subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to cancel subscription' },
      });
    }
  }

  async resumeSubscription(
    request: FastifyRequest<{ Params: SubscriptionParams }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;

      logger.info('Resuming subscription', { subscriptionId });

      const subscription = await subscriptionService.resumeSubscription(subscriptionId);

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to resume subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to resume subscription' },
      });
    }
  }

  async pauseSubscription(
    request: FastifyRequest<{ Params: SubscriptionParams; Body: PauseSubscriptionBody }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const { behavior, resumesAt } = request.body;

      logger.info('Pausing subscription', { subscriptionId, behavior });

      const subscription = await subscriptionService.pauseSubscription(
        subscriptionId,
        behavior,
        resumesAt ? new Date(resumesAt) : undefined
      );

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to pause subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to pause subscription' },
      });
    }
  }

  async unpauseSubscription(
    request: FastifyRequest<{ Params: SubscriptionParams }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;

      logger.info('Unpausing subscription', { subscriptionId });

      const subscription = await subscriptionService.unpauseSubscription(subscriptionId);

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to unpause subscription', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to unpause subscription' },
      });
    }
  }

  async changePlan(
    request: FastifyRequest<{ Params: SubscriptionParams; Body: ChangePlanBody }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const { planId, prorate } = request.body;

      logger.info('Changing subscription plan', { subscriptionId, planId });

      const subscription = await subscriptionService.changePlan(subscriptionId, planId, prorate);

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to change subscription plan', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to change plan' },
      });
    }
  }

  async updateQuantity(
    request: FastifyRequest<{ Params: SubscriptionParams; Body: UpdateQuantityBody }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const { quantity, prorate } = request.body;

      logger.info('Updating subscription quantity', { subscriptionId, quantity });

      const subscription = await subscriptionService.updateQuantity(subscriptionId, quantity, prorate);

      return reply.status(200).send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to update subscription quantity', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to update quantity' },
      });
    }
  }

  async recordUsage(
    request: FastifyRequest<{ Params: SubscriptionParams; Body: RecordUsageBody }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const { quantity, action } = request.body;

      logger.info('Recording usage', { subscriptionId, quantity, action });

      const usageRecord = await subscriptionService.recordUsage(subscriptionId, quantity, action);

      return reply.status(201).send({
        success: true,
        data: usageRecord,
      });
    } catch (error) {
      logger.error('Failed to record usage', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to record usage' },
      });
    }
  }

  async listSubscriptions(
    request: FastifyRequest<{ Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing subscriptions', { params });

      const result = await subscriptionService.listSubscriptions(params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list subscriptions', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to list subscriptions' },
      });
    }
  }

  async listCustomerSubscriptions(
    request: FastifyRequest<{ Params: { customerId: string }; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing customer subscriptions', { customerId, params });

      const result = await subscriptionService.listCustomerSubscriptions(customerId, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list customer subscriptions', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to list customer subscriptions' },
      });
    }
  }

  async listSubscriptionsByStatus(
    request: FastifyRequest<{ Params: { status: SubscriptionStatus }; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { status } = request.params;
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing subscriptions by status', { status, params });

      const result = await subscriptionService.listSubscriptionsByStatus(status, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list subscriptions by status', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to list subscriptions by status' },
      });
    }
  }

  async getSubscriptionsEndingSoon(
    request: FastifyRequest<{ Querystring: ListQueryParams & { days: number } }>,
    reply: FastifyReply
  ) {
    try {
      const { days, page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Getting subscriptions ending soon', { days, params });

      const result = await subscriptionService.getSubscriptionsEndingSoon(days, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get subscriptions ending soon', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to get subscriptions ending soon' },
      });
    }
  }

  async getTrialsEndingSoon(
    request: FastifyRequest<{ Querystring: ListQueryParams & { days: number } }>,
    reply: FastifyReply
  ) {
    try {
      const { days, page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Getting trials ending soon', { days, params });

      const result = await subscriptionService.getTrialEndingSoon(days, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get trials ending soon', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to get trials ending soon' },
      });
    }
  }

  async getSubscriptionWithPlan(
    request: FastifyRequest<{ Params: SubscriptionParams }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;

      logger.info('Getting subscription with plan', { subscriptionId });

      const result = await subscriptionService.getSubscriptionWithPlan(subscriptionId);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subscription not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get subscription with plan', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SUBSCRIPTION_ERROR', message: 'Failed to get subscription with plan' },
      });
    }
  }
}

export const subscriptionController = new SubscriptionController();
