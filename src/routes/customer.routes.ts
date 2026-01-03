import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { customerController } from '../controllers/customer.controller';

export async function customerRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // CRUD operations
  fastify.post('/', customerController.createCustomer.bind(customerController));
  fastify.get('/', customerController.listCustomers.bind(customerController));
  fastify.get('/search', customerController.searchCustomers.bind(customerController));
  fastify.get('/:customerId', customerController.getCustomer.bind(customerController));
  fastify.patch('/:customerId', customerController.updateCustomer.bind(customerController));
  fastify.delete('/:customerId', customerController.deleteCustomer.bind(customerController));

  // Status operations
  fastify.post('/:customerId/suspend', customerController.suspendCustomer.bind(customerController));
  fastify.post('/:customerId/reactivate', customerController.reactivateCustomer.bind(customerController));

  // Payment methods
  fastify.get('/:customerId/payment-methods', customerController.getPaymentMethods.bind(customerController));
  fastify.post('/:customerId/payment-methods', customerController.addPaymentMethod.bind(customerController));
  fastify.delete('/:customerId/payment-methods/:paymentMethodId', customerController.removePaymentMethod.bind(customerController));
  fastify.post('/:customerId/payment-methods/:paymentMethodId/default', customerController.setDefaultPaymentMethod.bind(customerController));

  // Billing portal
  fastify.post('/:customerId/billing-portal', customerController.createBillingPortalSession.bind(customerController));

  // Ramp integration
  fastify.post('/:customerId/link-ramp', customerController.linkRampBusiness.bind(customerController));
  fastify.get('/:customerId/ramp-data', customerController.getRampData.bind(customerController));

  // Stats and merge
  fastify.get('/:customerId/stats', customerController.getStats.bind(customerController));
  fastify.post('/:customerId/merge', customerController.mergeCustomers.bind(customerController));
}
