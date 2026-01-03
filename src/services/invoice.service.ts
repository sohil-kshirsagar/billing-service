import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';
import { stripeClient } from '../integrations/stripe/stripe.client';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { Invoice, InvoiceLineItem, InvoiceStatus, Currency } from '../types/billing';
import { PaginationParams, PaginatedResponse, DateRange } from '../types/common';

export interface CreateInvoiceInput {
  customerId: string;
  subscriptionId?: string;
  currency?: Currency;
  dueDate?: Date;
  lineItems: CreateLineItemInput[];
  metadata?: Record<string, unknown>;
  autoFinalize?: boolean;
  collectionMethod?: 'charge_automatically' | 'send_invoice';
  daysUntilDue?: number;
}

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  productId?: string;
  priceId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateInvoiceInput {
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export class InvoiceService {
  private invoiceRepository: InvoiceRepository;
  private customerRepository: CustomerRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository();
    this.customerRepository = new CustomerRepository();
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    try {
      logger.info('Creating invoice', { customerId: input.customerId });

      const customer = await this.customerRepository.findById(input.customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${input.customerId}`);
      }

      const lineItems: InvoiceLineItem[] = input.lineItems.map((item, index) => {
        const amount = item.quantity * item.unitPrice;
        const taxAmount = item.taxRate ? amount * (item.taxRate / 100) : 0;

        return {
          id: uuidv4(),
          invoiceId: '',
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount,
          taxRate: item.taxRate,
          taxAmount,
          productId: item.productId,
          priceId: item.priceId,
          periodStart: item.periodStart,
          periodEnd: item.periodEnd,
          metadata: item.metadata || {},
        };
      });

      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = lineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const total = subtotal + tax;

      let stripeInvoiceId: string | undefined;
      if (customer.stripeCustomerId) {
        const stripeInvoice = await stripeClient.createInvoice({
          customer: customer.stripeCustomerId,
          subscription: input.subscriptionId,
          collection_method: input.collectionMethod || 'charge_automatically',
          days_until_due: input.daysUntilDue,
          auto_advance: input.autoFinalize,
          metadata: input.metadata as Record<string, string>,
        });

        for (const item of input.lineItems) {
          await stripeClient.createInvoiceItem({
            customer: customer.stripeCustomerId,
            invoice: stripeInvoice.id,
            amount: Math.round(item.quantity * item.unitPrice * 100),
            currency: input.currency?.toLowerCase() || 'usd',
            description: item.description,
            quantity: item.quantity,
          });
        }

        stripeInvoiceId = stripeInvoice.id;
      }

      const invoiceNumber = await this.generateInvoiceNumber();

      const invoice: Invoice = {
        id: uuidv4(),
        customerId: input.customerId,
        subscriptionId: input.subscriptionId,
        stripeInvoiceId,
        number: invoiceNumber,
        status: 'draft',
        currency: input.currency || 'USD',
        subtotal,
        tax,
        total,
        amountPaid: 0,
        amountDue: total,
        lineItems: lineItems.map(item => ({ ...item, invoiceId: '' })),
        dueDate: input.dueDate || dayjs().add(30, 'day').toDate(),
        metadata: input.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await this.invoiceRepository.create(invoice);

      for (const item of created.lineItems) {
        item.invoiceId = created.id;
      }
      await this.invoiceRepository.update(created.id, { lineItems: created.lineItems });

      logger.info('Invoice created successfully', { invoiceId: created.id });
      return created;
    } catch (error) {
      logger.error('Failed to create invoice', { error, input });
      throw error;
    }
  }

  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    try {
      return await this.invoiceRepository.findById(invoiceId);
    } catch (error) {
      logger.error('Failed to get invoice', { error, invoiceId });
      throw error;
    }
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    try {
      return await this.invoiceRepository.findByNumber(invoiceNumber);
    } catch (error) {
      logger.error('Failed to get invoice by number', { error, invoiceNumber });
      throw error;
    }
  }

  async updateInvoice(invoiceId: string, input: UpdateInvoiceInput): Promise<Invoice> {
    try {
      logger.info('Updating invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status !== 'draft') {
        throw new Error('Can only update draft invoices');
      }

      const updated = await this.invoiceRepository.update(invoiceId, {
        ...input,
        updatedAt: new Date(),
      });

      logger.info('Invoice updated successfully', { invoiceId });
      return updated!;
    } catch (error) {
      logger.error('Failed to update invoice', { error, invoiceId });
      throw error;
    }
  }

  async addLineItem(invoiceId: string, input: CreateLineItemInput): Promise<Invoice> {
    try {
      logger.info('Adding line item to invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status !== 'draft') {
        throw new Error('Can only add line items to draft invoices');
      }

      const amount = input.quantity * input.unitPrice;
      const taxAmount = input.taxRate ? amount * (input.taxRate / 100) : 0;

      const lineItem: InvoiceLineItem = {
        id: uuidv4(),
        invoiceId,
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        amount,
        taxRate: input.taxRate,
        taxAmount,
        productId: input.productId,
        priceId: input.priceId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        metadata: input.metadata || {},
      };

      const newLineItems = [...invoice.lineItems, lineItem];
      const subtotal = newLineItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = newLineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const total = subtotal + tax;

      const updated = await this.invoiceRepository.update(invoiceId, {
        lineItems: newLineItems,
        subtotal,
        tax,
        total,
        amountDue: total - invoice.amountPaid,
        updatedAt: new Date(),
      });

      logger.info('Line item added successfully', { invoiceId, lineItemId: lineItem.id });
      return updated!;
    } catch (error) {
      logger.error('Failed to add line item', { error, invoiceId });
      throw error;
    }
  }

  async removeLineItem(invoiceId: string, lineItemId: string): Promise<Invoice> {
    try {
      logger.info('Removing line item from invoice', { invoiceId, lineItemId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status !== 'draft') {
        throw new Error('Can only remove line items from draft invoices');
      }

      const newLineItems = invoice.lineItems.filter(item => item.id !== lineItemId);
      const subtotal = newLineItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = newLineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const total = subtotal + tax;

      const updated = await this.invoiceRepository.update(invoiceId, {
        lineItems: newLineItems,
        subtotal,
        tax,
        total,
        amountDue: total - invoice.amountPaid,
        updatedAt: new Date(),
      });

      logger.info('Line item removed successfully', { invoiceId, lineItemId });
      return updated!;
    } catch (error) {
      logger.error('Failed to remove line item', { error, invoiceId, lineItemId });
      throw error;
    }
  }

  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    try {
      logger.info('Finalizing invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status !== 'draft') {
        throw new Error('Can only finalize draft invoices');
      }

      if (invoice.stripeInvoiceId) {
        await stripeClient.finalizeInvoice(invoice.stripeInvoiceId);
      }

      const updated = await this.invoiceRepository.update(invoiceId, {
        status: 'open',
        updatedAt: new Date(),
      });

      logger.info('Invoice finalized successfully', { invoiceId });
      return updated!;
    } catch (error) {
      logger.error('Failed to finalize invoice', { error, invoiceId });
      throw error;
    }
  }

  async sendInvoice(invoiceId: string): Promise<Invoice> {
    try {
      logger.info('Sending invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status === 'draft') {
        await this.finalizeInvoice(invoiceId);
      }

      if (invoice.stripeInvoiceId) {
        await stripeClient.sendInvoice(invoice.stripeInvoiceId);
      }

      logger.info('Invoice sent successfully', { invoiceId });
      return (await this.invoiceRepository.findById(invoiceId))!;
    } catch (error) {
      logger.error('Failed to send invoice', { error, invoiceId });
      throw error;
    }
  }

  async payInvoice(invoiceId: string, paymentMethodId?: string): Promise<Invoice> {
    try {
      logger.info('Paying invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status === 'paid') {
        throw new Error('Invoice is already paid');
      }

      if (invoice.stripeInvoiceId) {
        await stripeClient.payInvoice(invoice.stripeInvoiceId, paymentMethodId);
      }

      const updated = await this.invoiceRepository.update(invoiceId, {
        status: 'paid',
        amountPaid: invoice.total,
        amountDue: 0,
        paidAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info('Invoice paid successfully', { invoiceId });
      return updated!;
    } catch (error) {
      logger.error('Failed to pay invoice', { error, invoiceId });
      throw error;
    }
  }

  async voidInvoice(invoiceId: string): Promise<Invoice> {
    try {
      logger.info('Voiding invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status === 'paid') {
        throw new Error('Cannot void a paid invoice');
      }

      if (invoice.stripeInvoiceId) {
        await stripeClient.voidInvoice(invoice.stripeInvoiceId);
      }

      const updated = await this.invoiceRepository.update(invoiceId, {
        status: 'void',
        voidedAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info('Invoice voided successfully', { invoiceId });
      return updated!;
    } catch (error) {
      logger.error('Failed to void invoice', { error, invoiceId });
      throw error;
    }
  }

  async markUncollectible(invoiceId: string): Promise<Invoice> {
    try {
      logger.info('Marking invoice as uncollectible', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      const updated = await this.invoiceRepository.update(invoiceId, {
        status: 'uncollectible',
        updatedAt: new Date(),
      });

      logger.info('Invoice marked as uncollectible', { invoiceId });
      return updated!;
    } catch (error) {
      logger.error('Failed to mark invoice as uncollectible', { error, invoiceId });
      throw error;
    }
  }

  async listInvoices(params: PaginationParams): Promise<PaginatedResponse<Invoice>> {
    try {
      return await this.invoiceRepository.findAll(params);
    } catch (error) {
      logger.error('Failed to list invoices', { error, params });
      throw error;
    }
  }

  async listCustomerInvoices(customerId: string, params: PaginationParams): Promise<PaginatedResponse<Invoice>> {
    try {
      return await this.invoiceRepository.findByCustomerId(customerId, params);
    } catch (error) {
      logger.error('Failed to list customer invoices', { error, customerId });
      throw error;
    }
  }

  async listInvoicesByStatus(status: InvoiceStatus, params: PaginationParams): Promise<PaginatedResponse<Invoice>> {
    try {
      return await this.invoiceRepository.findByStatusPaginated(status, params);
    } catch (error) {
      logger.error('Failed to list invoices by status', { error, status });
      throw error;
    }
  }

  async listOverdueInvoices(params: PaginationParams): Promise<PaginatedResponse<Invoice>> {
    try {
      return await this.invoiceRepository.findOverdue(params);
    } catch (error) {
      logger.error('Failed to list overdue invoices', { error });
      throw error;
    }
  }

  async getInvoicesByDateRange(dateRange: DateRange, params: PaginationParams): Promise<PaginatedResponse<Invoice>> {
    try {
      return await this.invoiceRepository.findByDateRangePaginated(dateRange, params);
    } catch (error) {
      logger.error('Failed to get invoices by date range', { error, dateRange });
      throw error;
    }
  }

  async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    try {
      logger.info('Generating invoice PDF', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      const pdfBuffer = Buffer.from('Mock PDF content');

      logger.info('Invoice PDF generated successfully', { invoiceId });
      return pdfBuffer;
    } catch (error) {
      logger.error('Failed to generate invoice PDF', { error, invoiceId });
      throw error;
    }
  }

  async duplicateInvoice(invoiceId: string): Promise<Invoice> {
    try {
      logger.info('Duplicating invoice', { invoiceId });

      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      const newInvoice = await this.createInvoice({
        customerId: invoice.customerId,
        subscriptionId: invoice.subscriptionId,
        currency: invoice.currency,
        dueDate: dayjs().add(30, 'day').toDate(),
        lineItems: invoice.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          productId: item.productId,
          priceId: item.priceId,
          metadata: item.metadata,
        })),
        metadata: { duplicatedFrom: invoiceId },
      });

      logger.info('Invoice duplicated successfully', { originalId: invoiceId, newId: newInvoice.id });
      return newInvoice;
    } catch (error) {
      logger.error('Failed to duplicate invoice', { error, invoiceId });
      throw error;
    }
  }

  async processOverdueInvoices(): Promise<{ processed: number; failed: number }> {
    try {
      logger.info('Processing overdue invoices');

      const overdueInvoices = await this.invoiceRepository.findOverdueUnpaginated();
      let processed = 0;
      let failed = 0;

      for (const invoice of overdueInvoices) {
        try {
          await this.invoiceRepository.update(invoice.id, {
            status: 'past_due',
            updatedAt: new Date(),
          });
          processed++;
        } catch (error) {
          logger.error('Failed to process overdue invoice', { error, invoiceId: invoice.id });
          failed++;
        }
      }

      logger.info('Overdue invoice processing completed', { processed, failed });
      return { processed, failed };
    } catch (error) {
      logger.error('Failed to process overdue invoices', { error });
      throw error;
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const date = dayjs().format('YYYYMM');
    const count = await this.invoiceRepository.countByMonth(new Date());
    const sequence = String(count + 1).padStart(5, '0');
    return `INV-${date}-${sequence}`;
  }
}

export const invoiceService = new InvoiceService();
