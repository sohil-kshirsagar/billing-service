import { Currency, Money, Address, ContactInfo } from './common';

export interface Customer {
  id: string;
  externalId?: string;
  stripeCustomerId?: string;
  rampBusinessId?: string;
  email: string;
  name: string;
  company?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  contact: ContactInfo;
  metadata: Record<string, unknown>;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  stripeInvoiceId?: string;
  number: string;
  status: InvoiceStatus;
  currency: Currency;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lineItems: InvoiceLineItem[];
  dueDate: Date;
  paidAt?: Date;
  voidedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'past_due';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  productId?: string;
  priceId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  metadata: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  customerId: string;
  stripeSubscriptionId?: string;
  status: SubscriptionStatus;
  planId: string;
  quantity: number;
  currency: Currency;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'paused';

export interface Plan {
  id: string;
  name: string;
  description?: string;
  stripePriceId?: string;
  amount: number;
  currency: Currency;
  interval: BillingInterval;
  intervalCount: number;
  trialPeriodDays?: number;
  features: PlanFeature[];
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  limit?: number;
  unlimited: boolean;
}

export interface Payment {
  id: string;
  customerId: string;
  invoiceId?: string;
  stripePaymentIntentId?: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  paymentMethodDetails?: PaymentMethodDetails;
  failureCode?: string;
  failureMessage?: string;
  refundedAmount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethodType = 'card' | 'bank_transfer' | 'ach_debit' | 'wire' | 'check';

export interface PaymentMethodDetails {
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
    accountType: 'checking' | 'savings';
  };
}

export interface Refund {
  id: string;
  paymentId: string;
  stripeRefundId?: string;
  amount: number;
  currency: Currency;
  reason: RefundReason;
  status: RefundStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge';
export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  subscriptionItemId: string;
  quantity: number;
  timestamp: Date;
  action: 'set' | 'increment';
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface BillingCycle {
  id: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  status: BillingCycleStatus;
  invoiceId?: string;
  usageRecords: UsageRecord[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type BillingCycleStatus = 'active' | 'completed' | 'canceled';

export interface CreditNote {
  id: string;
  invoiceId: string;
  customerId: string;
  number: string;
  amount: number;
  currency: Currency;
  reason: string;
  status: CreditNoteStatus;
  lineItems: CreditNoteLineItem[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type CreditNoteStatus = 'issued' | 'void';

export interface CreditNoteLineItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  invoiceLineItemId?: string;
}

export interface TaxRate {
  id: string;
  name: string;
  description?: string;
  percentage: number;
  inclusive: boolean;
  country: string;
  state?: string;
  taxType: TaxType;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type TaxType = 'vat' | 'sales_tax' | 'gst' | 'hst' | 'pst' | 'qst';

export interface Discount {
  id: string;
  name: string;
  code?: string;
  type: DiscountType;
  amount?: number;
  percentage?: number;
  currency?: Currency;
  duration: DiscountDuration;
  durationInMonths?: number;
  maxRedemptions?: number;
  timesRedeemed: number;
  validFrom?: Date;
  validUntil?: Date;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type DiscountType = 'percentage' | 'fixed_amount';
export type DiscountDuration = 'once' | 'repeating' | 'forever';

export interface Quote {
  id: string;
  customerId: string;
  number: string;
  status: QuoteStatus;
  currency: Currency;
  subtotal: number;
  tax: number;
  total: number;
  lineItems: QuoteLineItem[];
  expiresAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type QuoteStatus = 'draft' | 'open' | 'accepted' | 'declined' | 'canceled' | 'expired';

export interface QuoteLineItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  planId?: string;
  metadata: Record<string, unknown>;
}
