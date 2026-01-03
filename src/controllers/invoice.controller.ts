import { FastifyRequest, FastifyReply } from 'fastify';
import { invoiceService, CreateInvoiceInput, CreateLineItemInput } from '../services/invoice.service';
import { logger } from '../utils/logger';
import { InvoiceStatus } from '../types/billing';
import { PaginationParams } from '../types/common';

interface InvoiceParams {
  invoiceId: string;
}

interface LineItemParams extends InvoiceParams {
  lineItemId: string;
}

interface ListQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface DateRangeQuery extends ListQueryParams {
  startDate: string;
  endDate: string;
}

interface PayInvoiceBody {
  paymentMethodId?: string;
}

export class InvoiceController {
  async createInvoice(
    request: FastifyRequest<{ Body: CreateInvoiceInput }>,
    reply: FastifyReply
  ) {
    try {
      const input = request.body;
      logger.info('Creating invoice', { customerId: input.customerId });

      const invoice = await invoiceService.createInvoice(input);

      return reply.status(201).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to create invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to create invoice' },
      });
    }
  }

  async getInvoice(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;
      logger.info('Getting invoice', { invoiceId });

      const invoice = await invoiceService.getInvoiceById(invoiceId);

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Invoice not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to get invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to get invoice' },
      });
    }
  }

  async updateInvoice(
    request: FastifyRequest<{ Params: InvoiceParams; Body: { dueDate?: string; metadata?: Record<string, unknown> } }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;
      const { dueDate, metadata } = request.body;

      logger.info('Updating invoice', { invoiceId });

      const invoice = await invoiceService.updateInvoice(invoiceId, {
        dueDate: dueDate ? new Date(dueDate) : undefined,
        metadata,
      });

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to update invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to update invoice' },
      });
    }
  }

  async addLineItem(
    request: FastifyRequest<{ Params: InvoiceParams; Body: CreateLineItemInput }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;
      const lineItem = request.body;

      logger.info('Adding line item to invoice', { invoiceId });

      const invoice = await invoiceService.addLineItem(invoiceId, lineItem);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to add line item', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to add line item' },
      });
    }
  }

  async removeLineItem(
    request: FastifyRequest<{ Params: LineItemParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId, lineItemId } = request.params;

      logger.info('Removing line item from invoice', { invoiceId, lineItemId });

      const invoice = await invoiceService.removeLineItem(invoiceId, lineItemId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to remove line item', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to remove line item' },
      });
    }
  }

  async finalizeInvoice(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      logger.info('Finalizing invoice', { invoiceId });

      const invoice = await invoiceService.finalizeInvoice(invoiceId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to finalize invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to finalize invoice' },
      });
    }
  }

  async sendInvoice(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      logger.info('Sending invoice', { invoiceId });

      const invoice = await invoiceService.sendInvoice(invoiceId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to send invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to send invoice' },
      });
    }
  }

  async payInvoice(
    request: FastifyRequest<{ Params: InvoiceParams; Body: PayInvoiceBody }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;
      const { paymentMethodId } = request.body;

      logger.info('Paying invoice', { invoiceId });

      const invoice = await invoiceService.payInvoice(invoiceId, paymentMethodId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to pay invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to pay invoice' },
      });
    }
  }

  async voidInvoice(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      logger.info('Voiding invoice', { invoiceId });

      const invoice = await invoiceService.voidInvoice(invoiceId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to void invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to void invoice' },
      });
    }
  }

  async markUncollectible(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      logger.info('Marking invoice as uncollectible', { invoiceId });

      const invoice = await invoiceService.markUncollectible(invoiceId);

      return reply.status(200).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to mark invoice as uncollectible', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to mark invoice as uncollectible' },
      });
    }
  }

  async listInvoices(
    request: FastifyRequest<{ Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing invoices', { params });

      const result = await invoiceService.listInvoices(params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list invoices', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to list invoices' },
      });
    }
  }

  async listCustomerInvoices(
    request: FastifyRequest<{ Params: { customerId: string }; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing customer invoices', { customerId, params });

      const result = await invoiceService.listCustomerInvoices(customerId, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list customer invoices', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to list customer invoices' },
      });
    }
  }

  async listInvoicesByStatus(
    request: FastifyRequest<{ Params: { status: InvoiceStatus }; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { status } = request.params;
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing invoices by status', { status, params });

      const result = await invoiceService.listInvoicesByStatus(status, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list invoices by status', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to list invoices by status' },
      });
    }
  }

  async listOverdueInvoices(
    request: FastifyRequest<{ Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing overdue invoices', { params });

      const result = await invoiceService.listOverdueInvoices(params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list overdue invoices', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to list overdue invoices' },
      });
    }
  }

  async generatePDF(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      logger.info('Generating invoice PDF', { invoiceId });

      const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceId);

      return reply
        .status(200)
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`)
        .send(pdfBuffer);
    } catch (error) {
      logger.error('Failed to generate invoice PDF', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to generate invoice PDF' },
      });
    }
  }

  async duplicateInvoice(
    request: FastifyRequest<{ Params: InvoiceParams }>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      logger.info('Duplicating invoice', { invoiceId });

      const invoice = await invoiceService.duplicateInvoice(invoiceId);

      return reply.status(201).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Failed to duplicate invoice', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'INVOICE_ERROR', message: 'Failed to duplicate invoice' },
      });
    }
  }
}

export const invoiceController = new InvoiceController();
