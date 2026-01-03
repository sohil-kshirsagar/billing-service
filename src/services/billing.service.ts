import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { stripeClient } from '../integrations/stripe/stripe.client';
import { rampClient } from '../integrations/ramp/ramp.client';
import { CustomerRepository } from '../repositories/customer.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import {
  Customer,
  Invoice,
  Subscription,
  Payment,
  Plan,
  BillingCycle,
  UsageRecord,
  Currency,
} from '../types/billing';
import { DateRange, PaginationParams, PaginatedResponse } from '../types/common';
import dayjs from 'dayjs';

export interface BillingOverview {
  totalRevenue: number;
  totalOutstanding: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerCustomer: number;
  currency: Currency;
}

export interface RevenueBreakdown {
  subscriptions: number;
  oneTimeCharges: number;
  usage: number;
  refunds: number;
  total: number;
  currency: Currency;
  period: DateRange;
}

export interface BillingMetrics {
  overview: BillingOverview;
  revenueBreakdown: RevenueBreakdown;
  topCustomers: Array<{ customer: Customer; revenue: number }>;
  revenueByPlan: Array<{ plan: Plan; revenue: number; customerCount: number }>;
}

export class BillingService {
  private customerRepository: CustomerRepository;
  private invoiceRepository: InvoiceRepository;
  private subscriptionRepository: SubscriptionRepository;
  private paymentRepository: PaymentRepository;

  constructor() {
    this.customerRepository = new CustomerRepository();
    this.invoiceRepository = new InvoiceRepository();
    this.subscriptionRepository = new SubscriptionRepository();
    this.paymentRepository = new PaymentRepository();
  }

  async getBillingOverview(currency: Currency = 'USD'): Promise<BillingOverview> {
    try {
      logger.info('Generating billing overview', { currency });

      const [
        totalRevenue,
        totalOutstanding,
        activeSubscriptions,
        mrr,
        customers,
      ] = await Promise.all([
        this.calculateTotalRevenue(currency),
        this.calculateOutstandingAmount(currency),
        this.subscriptionRepository.countActiveSubscriptions(),
        this.calculateMRR(currency),
        this.customerRepository.countActiveCustomers(),
      ]);

      const arr = mrr * 12;
      const churnRate = await this.calculateChurnRate();
      const arpc = customers > 0 ? totalRevenue / customers : 0;

      return {
        totalRevenue,
        totalOutstanding,
        activeSubscriptions,
        monthlyRecurringRevenue: mrr,
        annualRecurringRevenue: arr,
        churnRate,
        averageRevenuePerCustomer: arpc,
        currency,
      };
    } catch (error) {
      logger.error('Failed to generate billing overview', { error });
      throw error;
    }
  }

  async getRevenueBreakdown(dateRange: DateRange, currency: Currency = 'USD'): Promise<RevenueBreakdown> {
    try {
      logger.info('Generating revenue breakdown', { dateRange, currency });

      const [subscriptions, oneTimeCharges, usage, refunds] = await Promise.all([
        this.calculateSubscriptionRevenue(dateRange, currency),
        this.calculateOneTimeRevenue(dateRange, currency),
        this.calculateUsageRevenue(dateRange, currency),
        this.calculateRefundAmount(dateRange, currency),
      ]);

      return {
        subscriptions,
        oneTimeCharges,
        usage,
        refunds: -refunds,
        total: subscriptions + oneTimeCharges + usage - refunds,
        currency,
        period: dateRange,
      };
    } catch (error) {
      logger.error('Failed to generate revenue breakdown', { error, dateRange });
      throw error;
    }
  }

  async getBillingMetrics(dateRange: DateRange, currency: Currency = 'USD'): Promise<BillingMetrics> {
    try {
      logger.info('Generating billing metrics', { dateRange, currency });

      const [overview, revenueBreakdown, topCustomers, revenueByPlan] = await Promise.all([
        this.getBillingOverview(currency),
        this.getRevenueBreakdown(dateRange, currency),
        this.getTopCustomersByRevenue(10, currency),
        this.getRevenueByPlan(currency),
      ]);

      return {
        overview,
        revenueBreakdown,
        topCustomers,
        revenueByPlan,
      };
    } catch (error) {
      logger.error('Failed to generate billing metrics', { error, dateRange });
      throw error;
    }
  }

  async processEndOfPeriodBilling(subscriptionId: string): Promise<Invoice | null> {
    try {
      logger.info('Processing end of period billing', { subscriptionId });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (subscription.status !== 'active') {
        logger.warn('Subscription is not active, skipping billing', { subscriptionId, status: subscription.status });
        return null;
      }

      const usageRecords = await this.getUsageRecordsForPeriod(subscriptionId, {
        startDate: subscription.currentPeriodStart,
        endDate: subscription.currentPeriodEnd,
      });

      const invoice = await this.createInvoiceFromSubscription(subscription, usageRecords);

      await this.advanceSubscriptionPeriod(subscription);

      logger.info('End of period billing completed', { subscriptionId, invoiceId: invoice.id });
      return invoice;
    } catch (error) {
      logger.error('Failed to process end of period billing', { error, subscriptionId });
      throw error;
    }
  }

  async syncBillingWithStripe(customerId: string): Promise<void> {
    try {
      logger.info('Syncing billing data with Stripe', { customerId });

      const customer = await this.customerRepository.findById(customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      const [stripeSubscriptions, stripeInvoices] = await Promise.all([
        stripeClient.listSubscriptions(customer.stripeCustomerId),
        stripeClient.listInvoices(customer.stripeCustomerId),
      ]);

      for (const stripeSub of stripeSubscriptions.data) {
        await this.syncStripeSubscription(customerId, stripeSub);
      }

      for (const stripeInv of stripeInvoices.data) {
        await this.syncStripeInvoice(customerId, stripeInv);
      }

      logger.info('Billing sync with Stripe completed', { customerId });
    } catch (error) {
      logger.error('Failed to sync billing with Stripe', { error, customerId });
      throw error;
    }
  }

  async syncBillingWithRamp(customerId: string, businessId: string): Promise<void> {
    try {
      logger.info('Syncing billing data with Ramp', { customerId, businessId });

      const [transactions, bills] = await Promise.all([
        rampClient.listTransactions(businessId),
        rampClient.listBills(businessId),
      ]);

      for (const transaction of transactions.data) {
        await this.processRampTransaction(customerId, transaction);
      }

      for (const bill of bills.data) {
        await this.processRampBill(customerId, bill);
      }

      logger.info('Billing sync with Ramp completed', { customerId, businessId });
    } catch (error) {
      logger.error('Failed to sync billing with Ramp', { error, customerId, businessId });
      throw error;
    }
  }

  async calculateProration(
    subscriptionId: string,
    newPlanId: string,
    changeDate: Date = new Date()
  ): Promise<{ credit: number; charge: number; netAmount: number }> {
    try {
      logger.info('Calculating proration', { subscriptionId, newPlanId });

      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const periodStart = dayjs(subscription.currentPeriodStart);
      const periodEnd = dayjs(subscription.currentPeriodEnd);
      const changeDayjs = dayjs(changeDate);

      const totalDays = periodEnd.diff(periodStart, 'day');
      const remainingDays = periodEnd.diff(changeDayjs, 'day');
      const usedDays = totalDays - remainingDays;

      const currentDailyRate = subscription.quantity / totalDays;
      const credit = currentDailyRate * remainingDays;

      const newPlan = await this.getPlanById(newPlanId);
      const newDailyRate = newPlan.amount / totalDays;
      const charge = newDailyRate * remainingDays;

      return {
        credit: Math.round(credit * 100) / 100,
        charge: Math.round(charge * 100) / 100,
        netAmount: Math.round((charge - credit) * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to calculate proration', { error, subscriptionId, newPlanId });
      throw error;
    }
  }

  async generateBillingReport(dateRange: DateRange, format: 'json' | 'csv' = 'json'): Promise<unknown> {
    try {
      logger.info('Generating billing report', { dateRange, format });

      const [invoices, payments, refunds, subscriptions] = await Promise.all([
        this.invoiceRepository.findByDateRange(dateRange),
        this.paymentRepository.findByDateRange(dateRange),
        this.paymentRepository.findRefundsByDateRange(dateRange),
        this.subscriptionRepository.findByDateRange(dateRange),
      ]);

      const report = {
        period: dateRange,
        generatedAt: new Date(),
        summary: {
          totalInvoices: invoices.length,
          totalPayments: payments.length,
          totalRefunds: refunds.length,
          newSubscriptions: subscriptions.filter(s => s.createdAt >= dateRange.startDate).length,
          canceledSubscriptions: subscriptions.filter(s => s.canceledAt && s.canceledAt >= dateRange.startDate).length,
        },
        invoices: invoices.map(inv => ({
          id: inv.id,
          number: inv.number,
          customerId: inv.customerId,
          amount: inv.total,
          status: inv.status,
          createdAt: inv.createdAt,
        })),
        payments: payments.map(pay => ({
          id: pay.id,
          customerId: pay.customerId,
          amount: pay.amount,
          status: pay.status,
          createdAt: pay.createdAt,
        })),
        refunds: refunds.map(ref => ({
          id: ref.id,
          paymentId: ref.paymentId,
          amount: ref.amount,
          reason: ref.reason,
          createdAt: ref.createdAt,
        })),
      };

      if (format === 'csv') {
        return this.convertReportToCSV(report);
      }

      return report;
    } catch (error) {
      logger.error('Failed to generate billing report', { error, dateRange });
      throw error;
    }
  }

  async retryFailedPayment(invoiceId: string, paymentMethodId?: string): Promise<Payment> {
    try {
      logger.info('Retrying failed payment', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status === 'paid') {
        throw new Error('Invoice is already paid');
      }

      const customer = await this.customerRepository.findById(invoice.customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      const stripeInvoice = invoice.stripeInvoiceId
        ? await stripeClient.payInvoice(invoice.stripeInvoiceId, paymentMethodId)
        : null;

      const payment = await this.paymentRepository.create({
        id: uuidv4(),
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        stripePaymentIntentId: stripeInvoice?.payment_intent as string,
        amount: invoice.amountDue,
        currency: invoice.currency,
        status: 'succeeded',
        paymentMethod: 'card',
        refundedAmount: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.invoiceRepository.update(invoiceId, {
        status: 'paid',
        paidAt: new Date(),
        amountPaid: invoice.total,
        amountDue: 0,
      });

      logger.info('Payment retry successful', { invoiceId, paymentId: payment.id });
      return payment;
    } catch (error) {
      logger.error('Failed to retry payment', { error, invoiceId });
      throw error;
    }
  }

  async applyCredits(customerId: string, invoiceId: string): Promise<Invoice> {
    try {
      logger.info('Applying credits to invoice', { customerId, invoiceId });

      const [customer, invoice] = await Promise.all([
        this.customerRepository.findById(customerId),
        this.invoiceRepository.findById(invoiceId),
      ]);

      if (!customer || !invoice) {
        throw new Error('Customer or invoice not found');
      }

      const availableCredits = await this.getCustomerCredits(customerId);
      const creditToApply = Math.min(availableCredits, invoice.amountDue);

      if (creditToApply <= 0) {
        return invoice;
      }

      const updatedInvoice = await this.invoiceRepository.update(invoiceId, {
        amountPaid: invoice.amountPaid + creditToApply,
        amountDue: invoice.amountDue - creditToApply,
        status: invoice.amountDue - creditToApply === 0 ? 'paid' : invoice.status,
      });

      await this.deductCustomerCredits(customerId, creditToApply);

      logger.info('Credits applied successfully', { customerId, invoiceId, creditApplied: creditToApply });
      return updatedInvoice!;
    } catch (error) {
      logger.error('Failed to apply credits', { error, customerId, invoiceId });
      throw error;
    }
  }

  private async calculateTotalRevenue(currency: Currency): Promise<number> {
    const payments = await this.paymentRepository.findByStatus('succeeded');
    return payments
      .filter(p => p.currency === currency)
      .reduce((sum, p) => sum + p.amount - p.refundedAmount, 0);
  }

  private async calculateOutstandingAmount(currency: Currency): Promise<number> {
    const invoices = await this.invoiceRepository.findByStatus('open');
    return invoices
      .filter(i => i.currency === currency)
      .reduce((sum, i) => sum + i.amountDue, 0);
  }

  private async calculateMRR(currency: Currency): Promise<number> {
    const subscriptions = await this.subscriptionRepository.findByStatus('active');
    return subscriptions
      .filter(s => s.currency === currency)
      .reduce((sum, s) => {
        const monthlyAmount = this.normalizeToMonthly(s.quantity, 'month');
        return sum + monthlyAmount;
      }, 0);
  }

  private async calculateChurnRate(): Promise<number> {
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();
    const [canceledCount, totalAtStart] = await Promise.all([
      this.subscriptionRepository.countCanceledAfter(thirtyDaysAgo),
      this.subscriptionRepository.countActiveAt(thirtyDaysAgo),
    ]);
    return totalAtStart > 0 ? (canceledCount / totalAtStart) * 100 : 0;
  }

  private async calculateSubscriptionRevenue(dateRange: DateRange, currency: Currency): Promise<number> {
    const payments = await this.paymentRepository.findByDateRange(dateRange);
    return payments
      .filter(p => p.currency === currency && p.invoiceId)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  private async calculateOneTimeRevenue(dateRange: DateRange, currency: Currency): Promise<number> {
    const payments = await this.paymentRepository.findByDateRange(dateRange);
    return payments
      .filter(p => p.currency === currency && !p.invoiceId)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  private async calculateUsageRevenue(dateRange: DateRange, currency: Currency): Promise<number> {
    return 0;
  }

  private async calculateRefundAmount(dateRange: DateRange, currency: Currency): Promise<number> {
    const refunds = await this.paymentRepository.findRefundsByDateRange(dateRange);
    return refunds
      .filter(r => r.currency === currency)
      .reduce((sum, r) => sum + r.amount, 0);
  }

  private async getTopCustomersByRevenue(
    limit: number,
    currency: Currency
  ): Promise<Array<{ customer: Customer; revenue: number }>> {
    const customers = await this.customerRepository.findAll();
    const customerRevenue: Array<{ customer: Customer; revenue: number }> = [];

    for (const customer of customers) {
      const payments = await this.paymentRepository.findByCustomerId(customer.id);
      const revenue = payments
        .filter(p => p.currency === currency && p.status === 'succeeded')
        .reduce((sum, p) => sum + p.amount - p.refundedAmount, 0);
      customerRevenue.push({ customer, revenue });
    }

    return customerRevenue.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  private async getRevenueByPlan(currency: Currency): Promise<Array<{ plan: Plan; revenue: number; customerCount: number }>> {
    return [];
  }

  private async getUsageRecordsForPeriod(subscriptionId: string, dateRange: DateRange): Promise<UsageRecord[]> {
    return [];
  }

  private async createInvoiceFromSubscription(subscription: Subscription, usageRecords: UsageRecord[]): Promise<Invoice> {
    const invoice: Invoice = {
      id: uuidv4(),
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
      number: `INV-${Date.now()}`,
      status: 'open',
      currency: subscription.currency,
      subtotal: subscription.quantity,
      tax: 0,
      total: subscription.quantity,
      amountPaid: 0,
      amountDue: subscription.quantity,
      lineItems: [],
      dueDate: dayjs().add(30, 'day').toDate(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.invoiceRepository.create(invoice);
  }

  private async advanceSubscriptionPeriod(subscription: Subscription): Promise<void> {
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = dayjs(newPeriodStart).add(1, 'month').toDate();

    await this.subscriptionRepository.update(subscription.id, {
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
    });
  }

  private async syncStripeSubscription(customerId: string, stripeSubscription: any): Promise<void> {
    const existingSub = await this.subscriptionRepository.findByStripeId(stripeSubscription.id);

    const subscriptionData: Partial<Subscription> = {
      customerId,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status as any,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    };

    if (existingSub) {
      await this.subscriptionRepository.update(existingSub.id, subscriptionData);
    } else {
      await this.subscriptionRepository.create({
        ...subscriptionData,
        id: uuidv4(),
        planId: stripeSubscription.items.data[0]?.price.id || '',
        quantity: stripeSubscription.items.data[0]?.quantity || 1,
        currency: stripeSubscription.currency.toUpperCase() as Currency,
        metadata: {},
        createdAt: new Date(),
      } as Subscription);
    }
  }

  private async syncStripeInvoice(customerId: string, stripeInvoice: any): Promise<void> {
    const existingInv = await this.invoiceRepository.findByStripeId(stripeInvoice.id);

    const invoiceData: Partial<Invoice> = {
      customerId,
      stripeInvoiceId: stripeInvoice.id,
      status: stripeInvoice.status as any,
      subtotal: stripeInvoice.subtotal / 100,
      tax: stripeInvoice.tax || 0,
      total: stripeInvoice.total / 100,
      amountPaid: stripeInvoice.amount_paid / 100,
      amountDue: stripeInvoice.amount_due / 100,
      updatedAt: new Date(),
    };

    if (existingInv) {
      await this.invoiceRepository.update(existingInv.id, invoiceData);
    } else {
      await this.invoiceRepository.create({
        ...invoiceData,
        id: uuidv4(),
        number: stripeInvoice.number || `INV-${Date.now()}`,
        currency: stripeInvoice.currency.toUpperCase() as Currency,
        lineItems: [],
        dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : new Date(),
        metadata: {},
        createdAt: new Date(),
      } as Invoice);
    }
  }

  private async processRampTransaction(customerId: string, transaction: any): Promise<void> {
    logger.info('Processing Ramp transaction', { customerId, transactionId: transaction.id });
  }

  private async processRampBill(customerId: string, bill: any): Promise<void> {
    logger.info('Processing Ramp bill', { customerId, billId: bill.id });
  }

  private async getPlanById(planId: string): Promise<Plan> {
    return {
      id: planId,
      name: 'Mock Plan',
      amount: 9900,
      currency: 'USD',
      interval: 'month',
      intervalCount: 1,
      features: [],
      metadata: {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private normalizeToMonthly(amount: number, interval: string): number {
    switch (interval) {
      case 'day':
        return amount * 30;
      case 'week':
        return amount * 4;
      case 'month':
        return amount;
      case 'year':
        return amount / 12;
      default:
        return amount;
    }
  }

  private convertReportToCSV(report: any): string {
    return '';
  }

  private async getCustomerCredits(customerId: string): Promise<number> {
    return 0;
  }

  private async deductCustomerCredits(customerId: string, amount: number): Promise<void> {
    logger.info('Deducting customer credits', { customerId, amount });
  }
}

export const billingService = new BillingService();
