import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { invoiceController } from '../controllers/invoice.controller';

export async function invoiceRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // CRUD operations
  fastify.post('/', invoiceController.createInvoice.bind(invoiceController));
  fastify.get('/', invoiceController.listInvoices.bind(invoiceController));
  fastify.get('/overdue', invoiceController.listOverdueInvoices.bind(invoiceController));
  fastify.get('/status/:status', invoiceController.listInvoicesByStatus.bind(invoiceController));
  fastify.get('/customer/:customerId', invoiceController.listCustomerInvoices.bind(invoiceController));
  fastify.get('/:invoiceId', invoiceController.getInvoice.bind(invoiceController));
  fastify.patch('/:invoiceId', invoiceController.updateInvoice.bind(invoiceController));

  // Line items
  fastify.post('/:invoiceId/line-items', invoiceController.addLineItem.bind(invoiceController));
  fastify.delete('/:invoiceId/line-items/:lineItemId', invoiceController.removeLineItem.bind(invoiceController));

  // Invoice lifecycle
  fastify.post('/:invoiceId/finalize', invoiceController.finalizeInvoice.bind(invoiceController));
  fastify.post('/:invoiceId/send', invoiceController.sendInvoice.bind(invoiceController));
  fastify.post('/:invoiceId/pay', invoiceController.payInvoice.bind(invoiceController));
  fastify.post('/:invoiceId/void', invoiceController.voidInvoice.bind(invoiceController));
  fastify.post('/:invoiceId/mark-uncollectible', invoiceController.markUncollectible.bind(invoiceController));

  // Utilities
  fastify.get('/:invoiceId/pdf', invoiceController.generatePDF.bind(invoiceController));
  fastify.post('/:invoiceId/duplicate', invoiceController.duplicateInvoice.bind(invoiceController));
}
