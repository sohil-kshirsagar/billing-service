import { FastifyRequest, FastifyReply } from 'fastify';
import { stripeClient } from '../integrations/stripe/stripe.client';
import { rampClient } from '../integrations/ramp/ramp.client';
import { paymentService } from '../services/payment.service';
import { logger } from '../utils/logger';

export class WebhookController {
  async handleStripeWebhook(
    request: FastifyRequest<{ Body: any; Headers: { 'stripe-signature': string } }>,
    reply: FastifyReply
  ) {
    try {
      const signature = request.headers['stripe-signature'];
      const payload = request.rawBody || JSON.stringify(request.body);

      let event;
      try {
        event = stripeClient.constructWebhookEvent(payload as string, signature);
      } catch (err) {
        logger.warn('Invalid Stripe webhook signature');
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
        });
      }

      logger.info('Received Stripe webhook', { type: event.type, id: event.id });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object);
          break;
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object);
          break;
        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object);
          break;
        default:
          logger.info('Unhandled Stripe webhook event type', { type: event.type });
      }

      return reply.status(200).send({ received: true });
    } catch (error) {
      logger.error('Failed to handle Stripe webhook', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook' },
      });
    }
  }

  async handleRampWebhook(
    request: FastifyRequest<{ Body: any; Headers: { 'x-ramp-signature': string } }>,
    reply: FastifyReply
  ) {
    try {
      const signature = request.headers['x-ramp-signature'];
      const payload = JSON.stringify(request.body);

      const isValid = rampClient.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        logger.warn('Invalid Ramp webhook signature');
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
        });
      }

      const event = request.body;
      logger.info('Received Ramp webhook', { type: event.type, id: event.id });

      switch (event.type) {
        case 'transaction.created':
          await this.handleRampTransactionCreated(event.data);
          break;
        case 'transaction.updated':
          await this.handleRampTransactionUpdated(event.data);
          break;
        case 'card.created':
          await this.handleRampCardCreated(event.data);
          break;
        case 'card.suspended':
          await this.handleRampCardSuspended(event.data);
          break;
        case 'card.terminated':
          await this.handleRampCardTerminated(event.data);
          break;
        case 'user.created':
          await this.handleRampUserCreated(event.data);
          break;
        case 'reimbursement.created':
          await this.handleRampReimbursementCreated(event.data);
          break;
        case 'reimbursement.updated':
          await this.handleRampReimbursementUpdated(event.data);
          break;
        case 'bill.created':
          await this.handleRampBillCreated(event.data);
          break;
        case 'bill.paid':
          await this.handleRampBillPaid(event.data);
          break;
        default:
          logger.info('Unhandled Ramp webhook event type', { type: event.type });
      }

      return reply.status(200).send({ received: true });
    } catch (error) {
      logger.error('Failed to handle Ramp webhook', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook' },
      });
    }
  }

  // Stripe webhook handlers
  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    logger.info('Payment intent succeeded', { paymentIntentId: paymentIntent.id });
    await paymentService.processWebhookPaymentUpdate(paymentIntent.id, 'succeeded');
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    logger.info('Payment intent failed', { paymentIntentId: paymentIntent.id });
    await paymentService.processWebhookPaymentUpdate(paymentIntent.id, 'failed');
  }

  private async handleInvoicePaid(invoice: any): Promise<void> {
    logger.info('Invoice paid', { invoiceId: invoice.id });
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    logger.info('Invoice payment failed', { invoiceId: invoice.id });
  }

  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    logger.info('Subscription created', { subscriptionId: subscription.id });
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    logger.info('Subscription updated', { subscriptionId: subscription.id });
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    logger.info('Subscription deleted', { subscriptionId: subscription.id });
  }

  private async handleTrialWillEnd(subscription: any): Promise<void> {
    logger.info('Trial will end', { subscriptionId: subscription.id, trialEnd: subscription.trial_end });
  }

  private async handleChargeRefunded(charge: any): Promise<void> {
    logger.info('Charge refunded', { chargeId: charge.id });
  }

  private async handleDisputeCreated(dispute: any): Promise<void> {
    logger.info('Dispute created', { disputeId: dispute.id });
  }

  // Ramp webhook handlers
  private async handleRampTransactionCreated(transaction: any): Promise<void> {
    logger.info('Ramp transaction created', { transactionId: transaction.id });
  }

  private async handleRampTransactionUpdated(transaction: any): Promise<void> {
    logger.info('Ramp transaction updated', { transactionId: transaction.id });
  }

  private async handleRampCardCreated(card: any): Promise<void> {
    logger.info('Ramp card created', { cardId: card.id });
  }

  private async handleRampCardSuspended(card: any): Promise<void> {
    logger.info('Ramp card suspended', { cardId: card.id });
  }

  private async handleRampCardTerminated(card: any): Promise<void> {
    logger.info('Ramp card terminated', { cardId: card.id });
  }

  private async handleRampUserCreated(user: any): Promise<void> {
    logger.info('Ramp user created', { userId: user.id });
  }

  private async handleRampReimbursementCreated(reimbursement: any): Promise<void> {
    logger.info('Ramp reimbursement created', { reimbursementId: reimbursement.id });
  }

  private async handleRampReimbursementUpdated(reimbursement: any): Promise<void> {
    logger.info('Ramp reimbursement updated', { reimbursementId: reimbursement.id });
  }

  private async handleRampBillCreated(bill: any): Promise<void> {
    logger.info('Ramp bill created', { billId: bill.id });
  }

  private async handleRampBillPaid(bill: any): Promise<void> {
    logger.info('Ramp bill paid', { billId: bill.id });
  }
}

export const webhookController = new WebhookController();
