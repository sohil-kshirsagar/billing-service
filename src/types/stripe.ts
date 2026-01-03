import Stripe from 'stripe';

export type StripeCustomer = Stripe.Customer;
export type StripeSubscription = Stripe.Subscription;
export type StripeInvoice = Stripe.Invoice;
export type StripePaymentIntent = Stripe.PaymentIntent;
export type StripePaymentMethod = Stripe.PaymentMethod;
export type StripePrice = Stripe.Price;
export type StripeProduct = Stripe.Product;
export type StripeRefund = Stripe.Refund;
export type StripeCoupon = Stripe.Coupon;
export type StripeDiscount = Stripe.Discount;
export type StripeTaxRate = Stripe.TaxRate;
export type StripeCharge = Stripe.Charge;
export type StripeSetupIntent = Stripe.SetupIntent;
export type StripeSubscriptionItem = Stripe.SubscriptionItem;
export type StripeInvoiceItem = Stripe.InvoiceItem;
export type StripeUsageRecord = Stripe.UsageRecord;

export interface StripeWebhookEvent {
  id: string;
  type: StripeEventType;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key?: string;
  };
}

export type StripeEventType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  | 'invoice.voided'
  | 'payment_intent.created'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'payment_method.attached'
  | 'payment_method.detached'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.updated'
  | 'charge.dispute.closed'
  | 'setup_intent.created'
  | 'setup_intent.succeeded'
  | 'setup_intent.setup_failed';

export interface CreateStripeCustomerParams {
  email: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  shipping?: {
    name: string;
    phone?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  payment_method?: string;
  invoice_settings?: {
    default_payment_method?: string;
    custom_fields?: Array<{ name: string; value: string }>;
    footer?: string;
  };
  tax_exempt?: 'none' | 'exempt' | 'reverse';
}

export interface CreateStripeSubscriptionParams {
  customer: string;
  items: Array<{
    price: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }>;
  default_payment_method?: string;
  collection_method?: 'charge_automatically' | 'send_invoice';
  days_until_due?: number;
  trial_period_days?: number;
  trial_end?: number | 'now';
  billing_cycle_anchor?: number;
  proration_behavior?: 'create_prorations' | 'none' | 'always_invoice';
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  coupon?: string;
  promotion_code?: string;
  payment_behavior?: 'default_incomplete' | 'error_if_incomplete' | 'allow_incomplete' | 'pending_if_incomplete';
  off_session?: boolean;
  payment_settings?: {
    payment_method_types?: string[];
    save_default_payment_method?: 'off' | 'on_subscription';
  };
}

export interface UpdateStripeSubscriptionParams {
  items?: Array<{
    id?: string;
    price?: string;
    quantity?: number;
    deleted?: boolean;
    metadata?: Record<string, string>;
  }>;
  default_payment_method?: string;
  cancel_at_period_end?: boolean;
  proration_behavior?: 'create_prorations' | 'none' | 'always_invoice';
  metadata?: Record<string, string>;
  coupon?: string;
  trial_end?: number | 'now';
  pause_collection?: {
    behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
    resumes_at?: number;
  };
  payment_behavior?: 'default_incomplete' | 'error_if_incomplete' | 'allow_incomplete' | 'pending_if_incomplete';
  billing_cycle_anchor?: 'now' | 'unchanged';
}

export interface CreateStripeInvoiceParams {
  customer: string;
  subscription?: string;
  collection_method?: 'charge_automatically' | 'send_invoice';
  days_until_due?: number;
  description?: string;
  footer?: string;
  metadata?: Record<string, string>;
  statement_descriptor?: string;
  custom_fields?: Array<{ name: string; value: string }>;
  auto_advance?: boolean;
  discounts?: Array<{ coupon?: string; discount?: string }>;
  default_tax_rates?: string[];
}

export interface CreateStripeInvoiceItemParams {
  customer: string;
  invoice?: string;
  subscription?: string;
  price?: string;
  amount?: number;
  currency?: string;
  quantity?: number;
  description?: string;
  metadata?: Record<string, string>;
  tax_rates?: string[];
  discountable?: boolean;
  period?: {
    start: number;
    end: number;
  };
}

export interface CreateStripePaymentIntentParams {
  amount: number;
  currency: string;
  customer?: string;
  payment_method?: string;
  confirm?: boolean;
  off_session?: boolean;
  description?: string;
  metadata?: Record<string, string>;
  receipt_email?: string;
  setup_future_usage?: 'off_session' | 'on_session';
  capture_method?: 'automatic' | 'manual';
  payment_method_types?: string[];
  statement_descriptor?: string;
  statement_descriptor_suffix?: string;
  transfer_data?: {
    destination: string;
    amount?: number;
  };
  application_fee_amount?: number;
}

export interface CreateStripeRefundParams {
  payment_intent?: string;
  charge?: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
  refund_application_fee?: boolean;
  reverse_transfer?: boolean;
}

export interface CreateStripePriceParams {
  product?: string;
  product_data?: {
    name: string;
    active?: boolean;
    metadata?: Record<string, string>;
    statement_descriptor?: string;
    tax_code?: string;
    unit_label?: string;
  };
  currency: string;
  unit_amount?: number;
  unit_amount_decimal?: string;
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count?: number;
    trial_period_days?: number;
    usage_type?: 'licensed' | 'metered';
    aggregate_usage?: 'sum' | 'last_during_period' | 'last_ever' | 'max';
  };
  billing_scheme?: 'per_unit' | 'tiered';
  tiers_mode?: 'graduated' | 'volume';
  tiers?: Array<{
    up_to: number | 'inf';
    flat_amount?: number;
    flat_amount_decimal?: string;
    unit_amount?: number;
    unit_amount_decimal?: string;
  }>;
  metadata?: Record<string, string>;
  nickname?: string;
  tax_behavior?: 'exclusive' | 'inclusive' | 'unspecified';
  lookup_key?: string;
  transfer_lookup_key?: boolean;
}

export interface CreateStripeProductParams {
  name: string;
  active?: boolean;
  description?: string;
  metadata?: Record<string, string>;
  statement_descriptor?: string;
  tax_code?: string;
  unit_label?: string;
  default_price_data?: {
    currency: string;
    unit_amount?: number;
    unit_amount_decimal?: string;
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year';
      interval_count?: number;
    };
  };
  images?: string[];
  shippable?: boolean;
  url?: string;
}

export interface StripeListParams {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}

export interface StripeSearchParams {
  query: string;
  limit?: number;
  page?: string;
}
