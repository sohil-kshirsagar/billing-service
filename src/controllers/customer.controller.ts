import { FastifyRequest, FastifyReply } from 'fastify';
import { customerService, CreateCustomerInput, UpdateCustomerInput } from '../services/customer.service';
import { logger } from '../utils/logger';
import { PaginationParams } from '../types/common';

interface CustomerParams {
  customerId: string;
}

interface ListQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface SearchQueryParams extends ListQueryParams {
  q: string;
}

interface PaymentMethodParams extends CustomerParams {
  paymentMethodId: string;
}

interface BillingPortalBody {
  returnUrl: string;
}

interface LinkRampBody {
  rampBusinessId: string;
}

interface MergeCustomersBody {
  secondaryCustomerId: string;
}

export class CustomerController {
  async createCustomer(
    request: FastifyRequest<{ Body: CreateCustomerInput }>,
    reply: FastifyReply
  ) {
    try {
      const input = request.body;
      logger.info('Creating customer', { email: input.email });

      const customer = await customerService.createCustomer(input);

      return reply.status(201).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to create customer', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to create customer' },
      });
    }
  }

  async getCustomer(
    request: FastifyRequest<{ Params: CustomerParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      logger.info('Getting customer', { customerId });

      const customer = await customerService.getCustomerById(customerId);

      if (!customer) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to get customer', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to get customer' },
      });
    }
  }

  async updateCustomer(
    request: FastifyRequest<{ Params: CustomerParams; Body: UpdateCustomerInput }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const input = request.body;

      logger.info('Updating customer', { customerId });

      const customer = await customerService.updateCustomer(customerId, input);

      return reply.status(200).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to update customer', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to update customer' },
      });
    }
  }

  async deleteCustomer(
    request: FastifyRequest<{ Params: CustomerParams; Querystring: { deleteStripe?: boolean } }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { deleteStripe } = request.query;

      logger.info('Deleting customer', { customerId });

      await customerService.deleteCustomer(customerId, deleteStripe !== false);

      return reply.status(200).send({
        success: true,
        message: 'Customer deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete customer', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to delete customer' },
      });
    }
  }

  async listCustomers(
    request: FastifyRequest<{ Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Listing customers', { params });

      const result = await customerService.listCustomers(params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list customers', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to list customers' },
      });
    }
  }

  async searchCustomers(
    request: FastifyRequest<{ Querystring: SearchQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { q, page = 1, limit = 20, sortBy, sortOrder } = request.query;
      const params: PaginationParams = { page, limit, sortBy, sortOrder };

      logger.info('Searching customers', { query: q, params });

      const result = await customerService.searchCustomers(q, params);

      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to search customers', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to search customers' },
      });
    }
  }

  async suspendCustomer(
    request: FastifyRequest<{ Params: CustomerParams; Body: { reason?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { reason } = request.body;

      logger.info('Suspending customer', { customerId, reason });

      const customer = await customerService.suspendCustomer(customerId, reason);

      return reply.status(200).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to suspend customer', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to suspend customer' },
      });
    }
  }

  async reactivateCustomer(
    request: FastifyRequest<{ Params: CustomerParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;

      logger.info('Reactivating customer', { customerId });

      const customer = await customerService.reactivateCustomer(customerId);

      return reply.status(200).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to reactivate customer', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to reactivate customer' },
      });
    }
  }

  async getPaymentMethods(
    request: FastifyRequest<{ Params: CustomerParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;

      logger.info('Getting customer payment methods', { customerId });

      const paymentMethods = await customerService.getCustomerPaymentMethods(customerId);

      return reply.status(200).send({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      logger.error('Failed to get payment methods', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to get payment methods' },
      });
    }
  }

  async addPaymentMethod(
    request: FastifyRequest<{ Params: CustomerParams; Body: { paymentMethodId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { paymentMethodId } = request.body;

      logger.info('Adding payment method', { customerId, paymentMethodId });

      const paymentMethod = await customerService.addPaymentMethod(customerId, paymentMethodId);

      return reply.status(201).send({
        success: true,
        data: paymentMethod,
      });
    } catch (error) {
      logger.error('Failed to add payment method', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to add payment method' },
      });
    }
  }

  async removePaymentMethod(
    request: FastifyRequest<{ Params: PaymentMethodParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId, paymentMethodId } = request.params;

      logger.info('Removing payment method', { customerId, paymentMethodId });

      await customerService.removePaymentMethod(customerId, paymentMethodId);

      return reply.status(200).send({
        success: true,
        message: 'Payment method removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove payment method', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to remove payment method' },
      });
    }
  }

  async setDefaultPaymentMethod(
    request: FastifyRequest<{ Params: PaymentMethodParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId, paymentMethodId } = request.params;

      logger.info('Setting default payment method', { customerId, paymentMethodId });

      await customerService.setDefaultPaymentMethod(customerId, paymentMethodId);

      return reply.status(200).send({
        success: true,
        message: 'Default payment method set successfully',
      });
    } catch (error) {
      logger.error('Failed to set default payment method', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to set default payment method' },
      });
    }
  }

  async createBillingPortalSession(
    request: FastifyRequest<{ Params: CustomerParams; Body: BillingPortalBody }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { returnUrl } = request.body;

      logger.info('Creating billing portal session', { customerId });

      const url = await customerService.createBillingPortalSession(customerId, returnUrl);

      return reply.status(200).send({
        success: true,
        data: { url },
      });
    } catch (error) {
      logger.error('Failed to create billing portal session', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to create billing portal session' },
      });
    }
  }

  async linkRampBusiness(
    request: FastifyRequest<{ Params: CustomerParams; Body: LinkRampBody }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { rampBusinessId } = request.body;

      logger.info('Linking Ramp business', { customerId, rampBusinessId });

      const customer = await customerService.linkRampBusiness(customerId, rampBusinessId);

      return reply.status(200).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to link Ramp business', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to link Ramp business' },
      });
    }
  }

  async getRampData(
    request: FastifyRequest<{ Params: CustomerParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;

      logger.info('Getting customer Ramp data', { customerId });

      const rampData = await customerService.getCustomerRampData(customerId);

      if (!rampData) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Customer has no Ramp business linked' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: rampData,
      });
    } catch (error) {
      logger.error('Failed to get Ramp data', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to get Ramp data' },
      });
    }
  }

  async getStats(
    request: FastifyRequest<{ Params: CustomerParams }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;

      logger.info('Getting customer stats', { customerId });

      const stats = await customerService.getCustomerStats(customerId);

      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get customer stats', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to get customer stats' },
      });
    }
  }

  async mergeCustomers(
    request: FastifyRequest<{ Params: CustomerParams; Body: MergeCustomersBody }>,
    reply: FastifyReply
  ) {
    try {
      const { customerId } = request.params;
      const { secondaryCustomerId } = request.body;

      logger.info('Merging customers', { primaryId: customerId, secondaryId: secondaryCustomerId });

      const customer = await customerService.mergeCustomers(customerId, secondaryCustomerId);

      return reply.status(200).send({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to merge customers', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'CUSTOMER_ERROR', message: 'Failed to merge customers' },
      });
    }
  }
}

export const customerController = new CustomerController();
