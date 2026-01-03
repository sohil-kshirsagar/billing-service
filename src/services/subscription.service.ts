import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';
import { stripeClient } from '../integrations/stripe/stripe.client';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { PlanRepository } from '../repositories/plan.repository';
import { Subscription, SubscriptionStatus, Plan, Currency, UsageRecord } from '../types/billing';
import { PaginationParams, PaginatedResponse, DateRange } from '../types/common';

export interface CreateSubscriptionInput {
  customerId: string;
  planId: string;
  quantity?: number;
  trialDays?: number;
  paymentMethodId?: string;
  metadata?: Record<string, unknown>;
  billingCycleAnchor?: Date;
  cancelAtPeriodEnd?: boolean;
  couponId?: string;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  quantity?: number;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
  trialEnd?: Date | 'now';
  pauseCollection?: {
    behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
    resumesAt?: Date;
  };
}

export class SubscriptionService {
  private subscriptionRepository: SubscriptionRepository;
  private customerRepository: CustomerRepository;
  private planRepository: PlanRepository;

  constructor() {
    this.subscriptionRepository = new SubscriptionRepository();
    this.customerRepository = new CustomerRepository();
    this.planRepository = new PlanRepository();
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    try {
      logger.info('Creating subscription', { customerId: input.customerId, planId: input.planId });

      const [customer, plan] = await Promise.all([
        this.customerRepository.findById(input.customerId),
        this.planRepository.findById(input.planId),
      ]);

      if (!customer) {
        throw new Error(`Customer not found: ${input.customerId}`);
      }

      if (!plan) {
        throw new Error(`Plan not found: ${input.planId}`);
      }

      if (!plan.active) {
        throw new Error('Cannot subscribe to an inactive plan');
      }

      let stripeSubscriptionId: string | undefined;
      let currentPeriodStart = new Date();
      let currentPeriodEnd = this.calculatePeriodEnd(currentPeriodStart, plan.interval, plan.intervalCount);
      let trialStart: Date | undefined;
      let trialEnd: Date | undefined;
      let status: SubscriptionStatus = 'active';

      if (customer.stripeCustomerId && plan.stripePriceId) {
        const stripeSubscription = await stripeClient.createSubscription({
          customer: customer.stripeCustomerId,
          items: [{ price: plan.stripePriceId, quantity: input.quantity || 1 }],
          default_payment_method: input.paymentMethodId,
          trial_period_days: input.trialDays || plan.trialPeriodDays,
          billing_cycle_anchor: input.billingCycleAnchor
            ? Math.floor(input.billingCycleAnchor.getTime() / 1000)
            : undefined,
          cancel_at_period_end: input.cancelAtPeriodEnd,
          coupon: input.couponId,
          metadata: input.metadata as Record<string, string>,
        });

        stripeSubscriptionId = stripeSubscription.id;
        currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
        currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
        status = stripeSubscription.status as SubscriptionStatus;

        if (stripeSubscription.trial_start) {
          trialStart = new Date(stripeSubscription.trial_start * 1000);
          trialEnd = new Date(stripeSubscription.trial_end! * 1000);
          status = 'trialing';
        }
      } else if (input.trialDays) {
        trialStart = new Date();
        trialEnd = dayjs().add(input.trialDays, 'day').toDate();
        status = 'trialing';
      }

      const subscription: Subscription = {
        id: uuidv4(),
        customerId: input.customerId,
        stripeSubscriptionId,
        status,
        planId: input.planId,
        quantity: input.quantity || 1,
        currency: plan.currency,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd || false,
        trialStart,
        trialEnd,
        metadata: input.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await this.subscriptionRepository.create(subscription);
      logger.info('Subscription created successfully', { subscriptionId: created.id });

      return created;
    } catch (error) {
      logger.error('Failed to create subscription', { error, input });
      throw error;
    }
  }

  async getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
    try {
      return await this.subscriptionRepository.findById(subscriptionId);
    } catch (error) {
      logger.error('Failed to get subscription', { error, subscriptionId });
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    try {
      logger.info('Updating subscription', { subscriptionId });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.stripeSubscriptionId) {
        const updateParams: any = {
          cancel_at_period_end: input.cancelAtPeriodEnd,
          metadata: input.metadata as Record<string, string>,
        };

        if (input.planId) {
          const plan = await this.planRepository.findById(input.planId);
          if (!plan || !plan.stripePriceId) {
            throw new Error('Plan not found or has no Stripe price');
          }
          updateParams.items = [{ id: subscription.id, price: plan.stripePriceId, quantity: input.quantity }];
        } else if (input.quantity !== undefined) {
          updateParams.items = [{ id: subscription.id, quantity: input.quantity }];
        }

        if (input.trialEnd) {
          updateParams.trial_end = input.trialEnd === 'now' ? 'now' : Math.floor(input.trialEnd.getTime() / 1000);
        }

        if (input.pauseCollection) {
          updateParams.pause_collection = {
            behavior: input.pauseCollection.behavior,
            resumes_at: input.pauseCollection.resumesAt
              ? Math.floor(input.pauseCollection.resumesAt.getTime() / 1000)
              : undefined,
          };
        }

        await stripeClient.updateSubscription(subscription.stripeSubscriptionId, updateParams);
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, {
        planId: input.planId || subscription.planId,
        quantity: input.quantity ?? subscription.quantity,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
        metadata: { ...subscription.metadata, ...input.metadata },
        updatedAt: new Date(),
      });

      logger.info('Subscription updated successfully', { subscriptionId });
      return updated!;
    } catch (error) {
      logger.error('Failed to update subscription', { error, subscriptionId });
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<Subscription> {
    try {
      logger.info('Canceling subscription', { subscriptionId, immediate });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.stripeSubscriptionId) {
        await stripeClient.cancelSubscription(subscription.stripeSubscriptionId, !immediate);
      }

      const updateData: Partial<Subscription> = {
        canceledAt: new Date(),
        updatedAt: new Date(),
      };

      if (immediate) {
        updateData.status = 'canceled';
        updateData.endedAt = new Date();
      } else {
        updateData.cancelAtPeriodEnd = true;
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, updateData);
      logger.info('Subscription canceled successfully', { subscriptionId, immediate });

      return updated!;
    } catch (error) {
      logger.error('Failed to cancel subscription', { error, subscriptionId });
      throw error;
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      logger.info('Resuming subscription', { subscriptionId });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.status === 'canceled') {
        throw new Error('Cannot resume a canceled subscription');
      }

      if (subscription.stripeSubscriptionId) {
        await stripeClient.updateSubscription(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, {
        cancelAtPeriodEnd: false,
        canceledAt: undefined,
        updatedAt: new Date(),
      });

      logger.info('Subscription resumed successfully', { subscriptionId });
      return updated!;
    } catch (error) {
      logger.error('Failed to resume subscription', { error, subscriptionId });
      throw error;
    }
  }

  async pauseSubscription(
    subscriptionId: string,
    behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void' = 'keep_as_draft',
    resumesAt?: Date
  ): Promise<Subscription> {
    try {
      logger.info('Pausing subscription', { subscriptionId, behavior });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.stripeSubscriptionId) {
        await stripeClient.updateSubscription(subscription.stripeSubscriptionId, {
          pause_collection: {
            behavior,
            resumes_at: resumesAt ? Math.floor(resumesAt.getTime() / 1000) : undefined,
          },
        });
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, {
        status: 'paused',
        metadata: {
          ...subscription.metadata,
          pausedAt: new Date().toISOString(),
          pauseBehavior: behavior,
          resumesAt: resumesAt?.toISOString(),
        },
        updatedAt: new Date(),
      });

      logger.info('Subscription paused successfully', { subscriptionId });
      return updated!;
    } catch (error) {
      logger.error('Failed to pause subscription', { error, subscriptionId });
      throw error;
    }
  }

  async unpauseSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      logger.info('Unpausing subscription', { subscriptionId });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.stripeSubscriptionId) {
        await stripeClient.resumeSubscription(subscription.stripeSubscriptionId);
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, {
        status: 'active',
        metadata: {
          ...subscription.metadata,
          unpausedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      });

      logger.info('Subscription unpaused successfully', { subscriptionId });
      return updated!;
    } catch (error) {
      logger.error('Failed to unpause subscription', { error, subscriptionId });
      throw error;
    }
  }

  async changePlan(subscriptionId: string, newPlanId: string, prorate = true): Promise<Subscription> {
    try {
      logger.info('Changing subscription plan', { subscriptionId, newPlanId, prorate });

      const [subscription, newPlan] = await Promise.all([
        this.subscriptionRepository.findById(subscriptionId),
        this.planRepository.findById(newPlanId),
      ]);

      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (!newPlan) {
        throw new Error(`Plan not found: ${newPlanId}`);
      }

      if (!newPlan.active) {
        throw new Error('Cannot change to an inactive plan');
      }

      if (subscription.stripeSubscriptionId && newPlan.stripePriceId) {
        const stripeSubscription = await stripeClient.getSubscription(subscription.stripeSubscriptionId);
        const subscriptionItemId = stripeSubscription.items.data[0]?.id;

        await stripeClient.updateSubscription(subscription.stripeSubscriptionId, {
          items: [{ id: subscriptionItemId, price: newPlan.stripePriceId }],
          proration_behavior: prorate ? 'create_prorations' : 'none',
        });
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, {
        planId: newPlanId,
        currency: newPlan.currency,
        metadata: {
          ...subscription.metadata,
          previousPlanId: subscription.planId,
          planChangedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      });

      logger.info('Subscription plan changed successfully', { subscriptionId, newPlanId });
      return updated!;
    } catch (error) {
      logger.error('Failed to change subscription plan', { error, subscriptionId, newPlanId });
      throw error;
    }
  }

  async updateQuantity(subscriptionId: string, quantity: number, prorate = true): Promise<Subscription> {
    try {
      logger.info('Updating subscription quantity', { subscriptionId, quantity });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (quantity < 1) {
        throw new Error('Quantity must be at least 1');
      }

      if (subscription.stripeSubscriptionId) {
        const stripeSubscription = await stripeClient.getSubscription(subscription.stripeSubscriptionId);
        const subscriptionItemId = stripeSubscription.items.data[0]?.id;

        await stripeClient.updateSubscription(subscription.stripeSubscriptionId, {
          items: [{ id: subscriptionItemId, quantity }],
          proration_behavior: prorate ? 'create_prorations' : 'none',
        });
      }

      const updated = await this.subscriptionRepository.update(subscriptionId, {
        quantity,
        metadata: {
          ...subscription.metadata,
          previousQuantity: subscription.quantity,
          quantityChangedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      });

      logger.info('Subscription quantity updated successfully', { subscriptionId, quantity });
      return updated!;
    } catch (error) {
      logger.error('Failed to update subscription quantity', { error, subscriptionId, quantity });
      throw error;
    }
  }

  async recordUsage(subscriptionId: string, quantity: number, action: 'increment' | 'set' = 'increment'): Promise<UsageRecord> {
    try {
      logger.info('Recording usage', { subscriptionId, quantity, action });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.stripeSubscriptionId) {
        const stripeSubscription = await stripeClient.getSubscription(subscription.stripeSubscriptionId);
        const subscriptionItemId = stripeSubscription.items.data[0]?.id;

        if (subscriptionItemId) {
          await stripeClient.createUsageRecord(subscriptionItemId, quantity, undefined, action);
        }
      }

      const usageRecord: UsageRecord = {
        id: uuidv4(),
        subscriptionId,
        subscriptionItemId: subscription.stripeSubscriptionId || '',
        quantity,
        timestamp: new Date(),
        action,
        metadata: {},
        createdAt: new Date(),
      };

      await this.subscriptionRepository.createUsageRecord(usageRecord);
      logger.info('Usage recorded successfully', { subscriptionId, quantity });

      return usageRecord;
    } catch (error) {
      logger.error('Failed to record usage', { error, subscriptionId, quantity });
      throw error;
    }
  }

  async listSubscriptions(params: PaginationParams): Promise<PaginatedResponse<Subscription>> {
    try {
      return await this.subscriptionRepository.findAll(params);
    } catch (error) {
      logger.error('Failed to list subscriptions', { error, params });
      throw error;
    }
  }

  async listCustomerSubscriptions(customerId: string, params: PaginationParams): Promise<PaginatedResponse<Subscription>> {
    try {
      return await this.subscriptionRepository.findByCustomerId(customerId, params);
    } catch (error) {
      logger.error('Failed to list customer subscriptions', { error, customerId });
      throw error;
    }
  }

  async listSubscriptionsByStatus(status: SubscriptionStatus, params: PaginationParams): Promise<PaginatedResponse<Subscription>> {
    try {
      return await this.subscriptionRepository.findByStatusPaginated(status, params);
    } catch (error) {
      logger.error('Failed to list subscriptions by status', { error, status });
      throw error;
    }
  }

  async getSubscriptionsEndingSoon(days: number, params: PaginationParams): Promise<PaginatedResponse<Subscription>> {
    try {
      const endDate = dayjs().add(days, 'day').toDate();
      return await this.subscriptionRepository.findEndingBefore(endDate, params);
    } catch (error) {
      logger.error('Failed to get subscriptions ending soon', { error, days });
      throw error;
    }
  }

  async getTrialEndingSoon(days: number, params: PaginationParams): Promise<PaginatedResponse<Subscription>> {
    try {
      const endDate = dayjs().add(days, 'day').toDate();
      return await this.subscriptionRepository.findTrialEndingBefore(endDate, params);
    } catch (error) {
      logger.error('Failed to get trials ending soon', { error, days });
      throw error;
    }
  }

  async processExpiredTrials(): Promise<{ processed: number; failed: number }> {
    try {
      logger.info('Processing expired trials');

      const expiredTrials = await this.subscriptionRepository.findExpiredTrials();
      let processed = 0;
      let failed = 0;

      for (const subscription of expiredTrials) {
        try {
          await this.subscriptionRepository.update(subscription.id, {
            status: 'active',
            trialEnd: undefined,
            updatedAt: new Date(),
          });
          processed++;
        } catch (error) {
          logger.error('Failed to process expired trial', { error, subscriptionId: subscription.id });
          failed++;
        }
      }

      logger.info('Expired trial processing completed', { processed, failed });
      return { processed, failed };
    } catch (error) {
      logger.error('Failed to process expired trials', { error });
      throw error;
    }
  }

  async getSubscriptionWithPlan(subscriptionId: string): Promise<{ subscription: Subscription; plan: Plan } | null> {
    try {
      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) return null;

      const plan = await this.planRepository.findById(subscription.planId);
      if (!plan) return null;

      return { subscription, plan };
    } catch (error) {
      logger.error('Failed to get subscription with plan', { error, subscriptionId });
      throw error;
    }
  }

  private calculatePeriodEnd(start: Date, interval: string, intervalCount: number): Date {
    return dayjs(start).add(intervalCount, interval as dayjs.ManipulateType).toDate();
  }
}

export const subscriptionService = new SubscriptionService();
