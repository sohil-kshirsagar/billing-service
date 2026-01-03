import { FastifyRequest, FastifyReply } from 'fastify';
import { billingService, BillingOverview, RevenueBreakdown, BillingMetrics } from '../services/billing.service';
import { logger } from '../utils/logger';
import { Currency } from '../types/billing';
import { DateRange } from '../types/common';

interface DateRangeQuery {
  startDate: string;
  endDate: string;
  currency?: Currency;
}

interface SyncParams {
  customerId: string;
}

interface RampSyncParams extends SyncParams {
  businessId: string;
}

interface ProrationParams {
  subscriptionId: string;
}

interface ProrationQuery {
  newPlanId: string;
  changeDate?: string;
}

interface ReportQuery extends DateRangeQuery {
  format?: 'json' | 'csv';
}

interface RetryPaymentParams {
  invoiceId: string;
}

interface RetryPaymentBody {
  paymentMethodId?: string;
}

interface ApplyCreditsParams {
  customerId: string;
  invoiceId: string;
}

export class BillingController {
  async getOverview(
    request: FastifyRequest<{ Querystring: { currency?: Currency } }>,
    reply: FastifyReply
  ) {
    try {
      const currency = request.query.currency || 'USD';
      logger.info('Getting billing overview', { currency });

      const overview = await billingService.getBillingOverview(currency);

      return reply.status(200).send({
        success: true,
        data: overview,
      });
    } catch (error) {
      logger.error('Failed to get billing overview', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to get billing overview' },
      });
    }
  }

  async getRevenueBreakdown(
    request: FastifyRequest<{ Querystring: DateRangeQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, currency } = request.query;
      const dateRange: DateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };

      logger.info('Getting revenue breakdown', { dateRange, currency });

      const breakdown = await billingService.getRevenueBreakdown(dateRange, currency || 'USD');

      return reply.status(200).send({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      logger.error('Failed to get revenue breakdown', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to get revenue breakdown' },
      });
    }
  }

  async getMetrics(
    request: FastifyRequest<{ Querystring: DateRangeQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, currency } = request.query;
      const dateRange: DateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };

      logger.info('Getting billing metrics', { dateRange, currency });

      const metrics = await billingService.getBillingMetrics(dateRange, currency || 'USD');

      return reply.status(200).send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to get billing metrics', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to get billing metrics' },
      });
    }
  }

  async processEndOfPeriodBilling(
    request: FastifyRequest<{ Params: { subscriptionId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      logger.info('Processing end of period billing', { subscriptionId });

      const invoice = await billingService.processEndOfPeriodBilling(subscriptionId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to process end of period billing', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to process billing' },
      });
    }
  }

  async syncWithStripe(
    request: FastifyRequest<{ Params: SyncParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      logger.info('Syncing billing with Stripe', { customerId });

      await billingService.syncBillingWithStripe(customerId);

      return reply.status(200).send({
        success: true,
        message: 'Billing synced with Stripe successfully',
      });
    } catch (error) {
      logger.error('Failed to sync billing with Stripe', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to sync with Stripe' },
      });
    }
  }

  async syncWithRamp(
    request: FastifyRequest<{ Params: RampSyncParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId, businessId } = request.params;
      logger.info('Syncing billing with Ramp', { customerId, businessId });

      await billingService.syncBillingWithRamp(customerId, businessId);

      return reply.status(200).send({
        success: true,
        message: 'Billing synced with Ramp successfully',
      });
    } catch (error) {
      logger.error('Failed to sync billing with Ramp', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to sync with Ramp' },
      });
    }
  }

  async calculateProration(
    request: FastifyRequest<{ Params: ProrationParams; Querystring: ProrationQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { subscriptionId } = request.params;
      const { newPlanId, changeDate } = request.query;

      logger.info('Calculating proration', { subscriptionId, newPlanId });

      const proration = await billingService.calculateProration(
        subscriptionId,
        newPlanId,
        changeDate ? new Date(changeDate) : undefined
      );

      return reply.status(200).send({
        success: true,
        data: proration,
      });
    } catch (error) {
      logger.error('Failed to calculate proration', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to calculate proration' },
      });
    }
  }

  async generateReport(
    request: FastifyRequest<{ Querystring: ReportQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, format } = request.query;
      const dateRange: DateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };

      logger.info('Generating billing report', { dateRange, format });

      const report = await billingService.generateBillingReport(dateRange, format || 'json');

      if (format === 'csv') {
        return reply
          .status(200)
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', 'attachment; filename="billing-report.csv"')
          .send(report);
      }

      return reply.status(200).send({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to generate billing report', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to generate report' },
      });
    }
  }

  async retryFailedPayment(
    request: FastifyRequest<{ Params: RetryPaymentParams; Body: RetryPaymentBody }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;
      const { paymentMethodId } = request.body;

      logger.info('Retrying failed payment', { invoiceId });

      const payment = await billingService.retryFailedPayment(invoiceId, paymentMethodId);

      return reply.status(200).send({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Failed to retry payment', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to retry payment' },
      });
    }
  }

  async applyCredits(
    request: FastifyRequest<{ Params: ApplyCreditsParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId, invoiceId } = request.params;

      logger.info('Applying credits to invoice', { customerId, invoiceId });

      const invoice = await billingService.applyCredits(customerId, invoiceId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to apply credits', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'BILLING_ERROR', message: 'Failed to apply credits' },
      });
    }
  }
}

export const billingController = new BillingController();
