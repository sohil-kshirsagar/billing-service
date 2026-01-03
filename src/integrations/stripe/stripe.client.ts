import Stripe from 'stripe';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import {
  CreateStripeCustomerParams,
  CreateStripeSubscriptionParams,
  UpdateStripeSubscriptionParams,
  CreateStripeInvoiceParams,
  CreateStripeInvoiceItemParams,
  CreateStripePaymentIntentParams,
  CreateStripeRefundParams,
  CreateStripePriceParams,
  CreateStripeProductParams,
  StripeListParams,
  StripeSearchParams,
} from '../../types/stripe';

export class StripeClient {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }

  // Customer Methods
  async createCustomer(params: CreateStripeCustomerParams): Promise<Stripe.Customer> {
    try {
      logger.info('Creating Stripe customer', { email: params.email });
      const customer = await this.stripe.customers.create(params);
      logger.info('Stripe customer created', { customerId: customer.id });
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', { error, params });
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        throw new Error('Customer has been deleted');
      }
      return customer as Stripe.Customer;
    } catch (error) {
      logger.error('Failed to retrieve Stripe customer', { error, customerId });
      throw error;
    }
  }

  async updateCustomer(customerId: string, params: Partial<CreateStripeCustomerParams>): Promise<Stripe.Customer> {
    try {
      logger.info('Updating Stripe customer', { customerId });
      const customer = await this.stripe.customers.update(customerId, params);
      return customer;
    } catch (error) {
      logger.error('Failed to update Stripe customer', { error, customerId });
      throw error;
    }
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    try {
      logger.info('Deleting Stripe customer', { customerId });
      return await this.stripe.customers.del(customerId);
    } catch (error) {
      logger.error('Failed to delete Stripe customer', { error, customerId });
      throw error;
    }
  }

  async listCustomers(params?: StripeListParams): Promise<Stripe.ApiList<Stripe.Customer>> {
    try {
      return await this.stripe.customers.list(params);
    } catch (error) {
      logger.error('Failed to list Stripe customers', { error });
      throw error;
    }
  }

  async searchCustomers(params: StripeSearchParams): Promise<Stripe.ApiSearchResult<Stripe.Customer>> {
    try {
      return await this.stripe.customers.search(params);
    } catch (error) {
      logger.error('Failed to search Stripe customers', { error });
      throw error;
    }
  }

  // Subscription Methods
  async createSubscription(params: CreateStripeSubscriptionParams): Promise<Stripe.Subscription> {
    try {
      logger.info('Creating Stripe subscription', { customerId: params.customer });
      const subscription = await this.stripe.subscriptions.create(params);
      logger.info('Stripe subscription created', { subscriptionId: subscription.id });
      return subscription;
    } catch (error) {
      logger.error('Failed to create Stripe subscription', { error, params });
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe subscription', { error, subscriptionId });
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, params: UpdateStripeSubscriptionParams): Promise<Stripe.Subscription> {
    try {
      logger.info('Updating Stripe subscription', { subscriptionId });
      return await this.stripe.subscriptions.update(subscriptionId, params as Stripe.SubscriptionUpdateParams);
    } catch (error) {
      logger.error('Failed to update Stripe subscription', { error, subscriptionId });
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true): Promise<Stripe.Subscription> {
    try {
      logger.info('Canceling Stripe subscription', { subscriptionId, cancelAtPeriodEnd });
      if (cancelAtPeriodEnd) {
        return await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      }
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      logger.error('Failed to cancel Stripe subscription', { error, subscriptionId });
      throw error;
    }
  }

  async listSubscriptions(customerId?: string, params?: StripeListParams): Promise<Stripe.ApiList<Stripe.Subscription>> {
    try {
      return await this.stripe.subscriptions.list({ customer: customerId, ...params });
    } catch (error) {
      logger.error('Failed to list Stripe subscriptions', { error });
      throw error;
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      logger.info('Resuming Stripe subscription', { subscriptionId });
      return await this.stripe.subscriptions.resume(subscriptionId, { billing_cycle_anchor: 'now' });
    } catch (error) {
      logger.error('Failed to resume Stripe subscription', { error, subscriptionId });
      throw error;
    }
  }

  // Invoice Methods
  async createInvoice(params: CreateStripeInvoiceParams): Promise<Stripe.Invoice> {
    try {
      logger.info('Creating Stripe invoice', { customerId: params.customer });
      const invoice = await this.stripe.invoices.create(params);
      logger.info('Stripe invoice created', { invoiceId: invoice.id });
      return invoice;
    } catch (error) {
      logger.error('Failed to create Stripe invoice', { error, params });
      throw error;
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe invoice', { error, invoiceId });
      throw error;
    }
  }

  async finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      logger.info('Finalizing Stripe invoice', { invoiceId });
      return await this.stripe.invoices.finalizeInvoice(invoiceId);
    } catch (error) {
      logger.error('Failed to finalize Stripe invoice', { error, invoiceId });
      throw error;
    }
  }

  async payInvoice(invoiceId: string, paymentMethodId?: string): Promise<Stripe.Invoice> {
    try {
      logger.info('Paying Stripe invoice', { invoiceId });
      return await this.stripe.invoices.pay(invoiceId, { payment_method: paymentMethodId });
    } catch (error) {
      logger.error('Failed to pay Stripe invoice', { error, invoiceId });
      throw error;
    }
  }

  async voidInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      logger.info('Voiding Stripe invoice', { invoiceId });
      return await this.stripe.invoices.voidInvoice(invoiceId);
    } catch (error) {
      logger.error('Failed to void Stripe invoice', { error, invoiceId });
      throw error;
    }
  }

  async listInvoices(customerId?: string, params?: StripeListParams): Promise<Stripe.ApiList<Stripe.Invoice>> {
    try {
      return await this.stripe.invoices.list({ customer: customerId, ...params });
    } catch (error) {
      logger.error('Failed to list Stripe invoices', { error });
      throw error;
    }
  }

  async sendInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      logger.info('Sending Stripe invoice', { invoiceId });
      return await this.stripe.invoices.sendInvoice(invoiceId);
    } catch (error) {
      logger.error('Failed to send Stripe invoice', { error, invoiceId });
      throw error;
    }
  }

  // Invoice Item Methods
  async createInvoiceItem(params: CreateStripeInvoiceItemParams): Promise<Stripe.InvoiceItem> {
    try {
      return await this.stripe.invoiceItems.create(params);
    } catch (error) {
      logger.error('Failed to create Stripe invoice item', { error, params });
      throw error;
    }
  }

  async deleteInvoiceItem(invoiceItemId: string): Promise<Stripe.DeletedInvoiceItem> {
    try {
      return await this.stripe.invoiceItems.del(invoiceItemId);
    } catch (error) {
      logger.error('Failed to delete Stripe invoice item', { error, invoiceItemId });
      throw error;
    }
  }

  // Payment Intent Methods
  async createPaymentIntent(params: CreateStripePaymentIntentParams): Promise<Stripe.PaymentIntent> {
    try {
      logger.info('Creating Stripe payment intent', { amount: params.amount, currency: params.currency });
      const paymentIntent = await this.stripe.paymentIntents.create(params);
      logger.info('Stripe payment intent created', { paymentIntentId: paymentIntent.id });
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create Stripe payment intent', { error, params });
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<Stripe.PaymentIntent> {
    try {
      logger.info('Confirming Stripe payment intent', { paymentIntentId });
      return await this.stripe.paymentIntents.confirm(paymentIntentId, { payment_method: paymentMethodId });
    } catch (error) {
      logger.error('Failed to confirm Stripe payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  async capturePaymentIntent(paymentIntentId: string, amount?: number): Promise<Stripe.PaymentIntent> {
    try {
      logger.info('Capturing Stripe payment intent', { paymentIntentId, amount });
      return await this.stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amount });
    } catch (error) {
      logger.error('Failed to capture Stripe payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      logger.info('Canceling Stripe payment intent', { paymentIntentId });
      return await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      logger.error('Failed to cancel Stripe payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  // Refund Methods
  async createRefund(params: CreateStripeRefundParams): Promise<Stripe.Refund> {
    try {
      logger.info('Creating Stripe refund', { paymentIntentId: params.payment_intent });
      const refund = await this.stripe.refunds.create(params);
      logger.info('Stripe refund created', { refundId: refund.id });
      return refund;
    } catch (error) {
      logger.error('Failed to create Stripe refund', { error, params });
      throw error;
    }
  }

  async getRefund(refundId: string): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.retrieve(refundId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe refund', { error, refundId });
      throw error;
    }
  }

  async listRefunds(paymentIntentId?: string, params?: StripeListParams): Promise<Stripe.ApiList<Stripe.Refund>> {
    try {
      return await this.stripe.refunds.list({ payment_intent: paymentIntentId, ...params });
    } catch (error) {
      logger.error('Failed to list Stripe refunds', { error });
      throw error;
    }
  }

  // Payment Method Methods
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    try {
      logger.info('Attaching payment method to customer', { paymentMethodId, customerId });
      return await this.stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (error) {
      logger.error('Failed to attach payment method', { error, paymentMethodId, customerId });
      throw error;
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      logger.info('Detaching payment method', { paymentMethodId });
      return await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      logger.error('Failed to detach payment method', { error, paymentMethodId });
      throw error;
    }
  }

  async listPaymentMethods(customerId: string, type: Stripe.PaymentMethodListParams.Type = 'card'): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    try {
      return await this.stripe.paymentMethods.list({ customer: customerId, type });
    } catch (error) {
      logger.error('Failed to list payment methods', { error, customerId });
      throw error;
    }
  }

  // Product and Price Methods
  async createProduct(params: CreateStripeProductParams): Promise<Stripe.Product> {
    try {
      logger.info('Creating Stripe product', { name: params.name });
      const product = await this.stripe.products.create(params);
      logger.info('Stripe product created', { productId: product.id });
      return product;
    } catch (error) {
      logger.error('Failed to create Stripe product', { error, params });
      throw error;
    }
  }

  async getProduct(productId: string): Promise<Stripe.Product> {
    try {
      return await this.stripe.products.retrieve(productId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe product', { error, productId });
      throw error;
    }
  }

  async updateProduct(productId: string, params: Partial<CreateStripeProductParams>): Promise<Stripe.Product> {
    try {
      return await this.stripe.products.update(productId, params);
    } catch (error) {
      logger.error('Failed to update Stripe product', { error, productId });
      throw error;
    }
  }

  async listProducts(params?: StripeListParams & { active?: boolean }): Promise<Stripe.ApiList<Stripe.Product>> {
    try {
      return await this.stripe.products.list(params);
    } catch (error) {
      logger.error('Failed to list Stripe products', { error });
      throw error;
    }
  }

  async createPrice(params: CreateStripePriceParams): Promise<Stripe.Price> {
    try {
      logger.info('Creating Stripe price', { product: params.product });
      const price = await this.stripe.prices.create(params);
      logger.info('Stripe price created', { priceId: price.id });
      return price;
    } catch (error) {
      logger.error('Failed to create Stripe price', { error, params });
      throw error;
    }
  }

  async getPrice(priceId: string): Promise<Stripe.Price> {
    try {
      return await this.stripe.prices.retrieve(priceId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe price', { error, priceId });
      throw error;
    }
  }

  async listPrices(productId?: string, params?: StripeListParams): Promise<Stripe.ApiList<Stripe.Price>> {
    try {
      return await this.stripe.prices.list({ product: productId, ...params });
    } catch (error) {
      logger.error('Failed to list Stripe prices', { error });
      throw error;
    }
  }

  // Usage Record Methods
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number,
    action: 'increment' | 'set' = 'increment'
  ): Promise<Stripe.UsageRecord> {
    try {
      logger.info('Creating usage record', { subscriptionItemId, quantity, action });
      return await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action,
      });
    } catch (error) {
      logger.error('Failed to create usage record', { error, subscriptionItemId });
      throw error;
    }
  }

  async listUsageRecordSummaries(subscriptionItemId: string, params?: StripeListParams): Promise<Stripe.ApiList<Stripe.UsageRecordSummary>> {
    try {
      return await this.stripe.subscriptionItems.listUsageRecordSummaries(subscriptionItemId, params);
    } catch (error) {
      logger.error('Failed to list usage record summaries', { error, subscriptionItemId });
      throw error;
    }
  }

  // Coupon Methods
  async createCoupon(params: Stripe.CouponCreateParams): Promise<Stripe.Coupon> {
    try {
      logger.info('Creating Stripe coupon', { name: params.name });
      return await this.stripe.coupons.create(params);
    } catch (error) {
      logger.error('Failed to create Stripe coupon', { error, params });
      throw error;
    }
  }

  async getCoupon(couponId: string): Promise<Stripe.Coupon> {
    try {
      return await this.stripe.coupons.retrieve(couponId);
    } catch (error) {
      logger.error('Failed to retrieve Stripe coupon', { error, couponId });
      throw error;
    }
  }

  async deleteCoupon(couponId: string): Promise<Stripe.DeletedCoupon> {
    try {
      return await this.stripe.coupons.del(couponId);
    } catch (error) {
      logger.error('Failed to delete Stripe coupon', { error, couponId });
      throw error;
    }
  }

  // Tax Rate Methods
  async createTaxRate(params: Stripe.TaxRateCreateParams): Promise<Stripe.TaxRate> {
    try {
      logger.info('Creating Stripe tax rate', { displayName: params.display_name });
      return await this.stripe.taxRates.create(params);
    } catch (error) {
      logger.error('Failed to create Stripe tax rate', { error, params });
      throw error;
    }
  }

  async listTaxRates(params?: StripeListParams & { active?: boolean }): Promise<Stripe.ApiList<Stripe.TaxRate>> {
    try {
      return await this.stripe.taxRates.list(params);
    } catch (error) {
      logger.error('Failed to list Stripe tax rates', { error });
      throw error;
    }
  }

  // Setup Intent Methods
  async createSetupIntent(customerId: string, paymentMethodTypes?: string[]): Promise<Stripe.SetupIntent> {
    try {
      logger.info('Creating Stripe setup intent', { customerId });
      return await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: paymentMethodTypes || ['card'],
      });
    } catch (error) {
      logger.error('Failed to create Stripe setup intent', { error, customerId });
      throw error;
    }
  }

  async confirmSetupIntent(setupIntentId: string, paymentMethodId: string): Promise<Stripe.SetupIntent> {
    try {
      logger.info('Confirming Stripe setup intent', { setupIntentId });
      return await this.stripe.setupIntents.confirm(setupIntentId, { payment_method: paymentMethodId });
    } catch (error) {
      logger.error('Failed to confirm Stripe setup intent', { error, setupIntentId });
      throw error;
    }
  }

  // Webhook Verification
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);
    } catch (error) {
      logger.error('Failed to construct webhook event', { error });
      throw error;
    }
  }

  // Billing Portal
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    try {
      logger.info('Creating billing portal session', { customerId });
      return await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
    } catch (error) {
      logger.error('Failed to create billing portal session', { error, customerId });
      throw error;
    }
  }

  // Checkout Session
  async createCheckoutSession(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session> {
    try {
      logger.info('Creating checkout session', { mode: params.mode });
      return await this.stripe.checkout.sessions.create(params);
    } catch (error) {
      logger.error('Failed to create checkout session', { error, params });
      throw error;
    }
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      logger.error('Failed to retrieve checkout session', { error, sessionId });
      throw error;
    }
  }
}
export const stripeClient = new StripeClient();
