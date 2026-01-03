import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { stripeClient } from '../integrations/stripe/stripe.client';
import { rampClient } from '../integrations/ramp/ramp.client';
import { CustomerRepository } from '../repositories/customer.repository';
import { Customer, CustomerStatus } from '../types/billing';
import { PaginationParams, PaginatedResponse, Address, ContactInfo } from '../types/common';

export interface CreateCustomerInput {
  email: string;
  name: string;
  company?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  contact: ContactInfo;
  metadata?: Record<string, unknown>;
  createStripeCustomer?: boolean;
  rampBusinessId?: string;
}

export interface UpdateCustomerInput {
  email?: string;
  name?: string;
  company?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  contact?: Partial<ContactInfo>;
  metadata?: Record<string, unknown>;
  status?: CustomerStatus;
}

export class CustomerService {
  private customerRepository: CustomerRepository;

  constructor() {
    this.customerRepository = new CustomerRepository();
  }

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    try {
      logger.info('Creating customer', { email: input.email });

      let stripeCustomerId: string | undefined;
      if (input.createStripeCustomer !== false) {
        const stripeCustomer = await stripeClient.createCustomer({
          email: input.email,
          name: input.name,
          phone: input.contact.phone,
          metadata: input.metadata as Record<string, string>,
          address: input.billingAddress
            ? {
                line1: input.billingAddress.line1,
                line2: input.billingAddress.line2,
                city: input.billingAddress.city,
                state: input.billingAddress.state,
                postal_code: input.billingAddress.postalCode,
                country: input.billingAddress.country,
              }
            : undefined,
        });
        stripeCustomerId = stripeCustomer.id;
        logger.info('Stripe customer created', { stripeCustomerId });
      }

      const customer: Customer = {
        id: uuidv4(),
        externalId: undefined,
        stripeCustomerId,
        rampBusinessId: input.rampBusinessId,
        email: input.email,
        name: input.name,
        company: input.company,
        billingAddress: input.billingAddress,
        shippingAddress: input.shippingAddress,
        contact: input.contact,
        metadata: input.metadata || {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await this.customerRepository.create(customer);
      logger.info('Customer created successfully', { customerId: created.id });

      return created;
    } catch (error) {
      logger.error('Failed to create customer', { error, input });
      throw error;
    }
  }

  async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      return await this.customerRepository.findById(customerId);
    } catch (error) {
      logger.error('Failed to get customer', { error, customerId });
      throw error;
    }
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    try {
      return await this.customerRepository.findByEmail(email);
    } catch (error) {
      logger.error('Failed to get customer by email', { error, email });
      throw error;
    }
  }

  async getCustomerByStripeId(stripeCustomerId: string): Promise<Customer | null> {
    try {
      return await this.customerRepository.findByStripeId(stripeCustomerId);
    } catch (error) {
      logger.error('Failed to get customer by Stripe ID', { error, stripeCustomerId });
      throw error;
    }
  }

  async updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<Customer> {
    try {
      logger.info('Updating customer', { customerId });

      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      if (customer.stripeCustomerId) {
        await stripeClient.updateCustomer(customer.stripeCustomerId, {
          email: input.email,
          name: input.name,
          phone: input.contact?.phone,
          address: input.billingAddress
            ? {
                line1: input.billingAddress.line1,
                line2: input.billingAddress.line2,
                city: input.billingAddress.city,
                state: input.billingAddress.state,
                postal_code: input.billingAddress.postalCode,
                country: input.billingAddress.country,
              }
            : undefined,
        });
      }

      const updated = await this.customerRepository.update(customerId, {
        ...input,
        contact: input.contact ? { ...customer.contact, ...input.contact } : customer.contact,
        updatedAt: new Date(),
      });

      logger.info('Customer updated successfully', { customerId });
      return updated!;
    } catch (error) {
      logger.error('Failed to update customer', { error, customerId });
      throw error;
    }
  }

  async deleteCustomer(customerId: string, deleteStripeCustomer = true): Promise<void> {
    try {
      logger.info('Deleting customer', { customerId });

      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      if (deleteStripeCustomer && customer.stripeCustomerId) {
        await stripeClient.deleteCustomer(customer.stripeCustomerId);
        logger.info('Stripe customer deleted', { stripeCustomerId: customer.stripeCustomerId });
      }

      await this.customerRepository.delete(customerId);
      logger.info('Customer deleted successfully', { customerId });
    } catch (error) {
      logger.error('Failed to delete customer', { error, customerId });
      throw error;
    }
  }

  async listCustomers(params: PaginationParams): Promise<PaginatedResponse<Customer>> {
    try {
      return await this.customerRepository.findAll(params);
    } catch (error) {
      logger.error('Failed to list customers', { error, params });
      throw error;
    }
  }

  async searchCustomers(query: string, params: PaginationParams): Promise<PaginatedResponse<Customer>> {
    try {
      return await this.customerRepository.search(query, params);
    } catch (error) {
      logger.error('Failed to search customers', { error, query });
      throw error;
    }
  }

  async suspendCustomer(customerId: string, reason?: string): Promise<Customer> {
    try {
      logger.info('Suspending customer', { customerId, reason });

      const updated = await this.customerRepository.update(customerId, {
        status: 'suspended',
        metadata: { suspendedAt: new Date().toISOString(), suspendReason: reason },
        updatedAt: new Date(),
      });

      if (!updated) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      logger.info('Customer suspended successfully', { customerId });
      return updated;
    } catch (error) {
      logger.error('Failed to suspend customer', { error, customerId });
      throw error;
    }
  }

  async reactivateCustomer(customerId: string): Promise<Customer> {
    try {
      logger.info('Reactivating customer', { customerId });

      const updated = await this.customerRepository.update(customerId, {
        status: 'active',
        metadata: { reactivatedAt: new Date().toISOString() },
        updatedAt: new Date(),
      });

      if (!updated) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      logger.info('Customer reactivated successfully', { customerId });
      return updated;
    } catch (error) {
      logger.error('Failed to reactivate customer', { error, customerId });
      throw error;
    }
  }

  async getCustomerPaymentMethods(customerId: string): Promise<any[]> {
    try {
      const customer = await this.customerRepository.findById(customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      const paymentMethods = await stripeClient.listPaymentMethods(customer.stripeCustomerId);
      return paymentMethods.data;
    } catch (error) {
      logger.error('Failed to get customer payment methods', { error, customerId });
      throw error;
    }
  }

  async addPaymentMethod(customerId: string, paymentMethodId: string): Promise<any> {
    try {
      logger.info('Adding payment method to customer', { customerId, paymentMethodId });

      const customer = await this.customerRepository.findById(customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      const paymentMethod = await stripeClient.attachPaymentMethod(paymentMethodId, customer.stripeCustomerId);
      logger.info('Payment method added successfully', { customerId, paymentMethodId });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to add payment method', { error, customerId });
      throw error;
    }
  }

  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      logger.info('Removing payment method from customer', { customerId, paymentMethodId });

      await stripeClient.detachPaymentMethod(paymentMethodId);
      logger.info('Payment method removed successfully', { customerId, paymentMethodId });
    } catch (error) {
      logger.error('Failed to remove payment method', { error, customerId });
      throw error;
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      logger.info('Setting default payment method', { customerId, paymentMethodId });

      const customer = await this.customerRepository.findById(customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      await stripeClient.updateCustomer(customer.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info('Default payment method set successfully', { customerId, paymentMethodId });
    } catch (error) {
      logger.error('Failed to set default payment method', { error, customerId });
      throw error;
    }
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    try {
      logger.info('Creating billing portal session', { customerId });

      const customer = await this.customerRepository.findById(customerId);
      if (!customer || !customer.stripeCustomerId) {
        throw new Error('Customer not found or no Stripe customer ID');
      }

      const session = await stripeClient.createBillingPortalSession(customer.stripeCustomerId, returnUrl);
      return session.url;
    } catch (error) {
      logger.error('Failed to create billing portal session', { error, customerId });
      throw error;
    }
  }

  async linkRampBusiness(customerId: string, rampBusinessId: string): Promise<Customer> {
    try {
      logger.info('Linking Ramp business to customer', { customerId, rampBusinessId });

      await rampClient.getBusiness(rampBusinessId);

      const updated = await this.customerRepository.update(customerId, {
        rampBusinessId,
        updatedAt: new Date(),
      });

      if (!updated) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      logger.info('Ramp business linked successfully', { customerId, rampBusinessId });
      return updated;
    } catch (error) {
      logger.error('Failed to link Ramp business', { error, customerId, rampBusinessId });
      throw error;
    }
  }

  async getCustomerRampData(customerId: string): Promise<{
    users: any[];
    cards: any[];
    transactions: any[];
  } | null> {
    try {
      const customer = await this.customerRepository.findById(customerId);
      if (!customer || !customer.rampBusinessId) {
        return null;
      }

      const [users, cards, transactions] = await Promise.all([
        rampClient.listUsers(customer.rampBusinessId),
        rampClient.listCards(customer.rampBusinessId),
        rampClient.listTransactions(customer.rampBusinessId),
      ]);

      return {
        users: users.data,
        cards: cards.data,
        transactions: transactions.data,
      };
    } catch (error) {
      logger.error('Failed to get customer Ramp data', { error, customerId });
      throw error;
    }
  }

  async getCustomerStats(customerId: string): Promise<{
    totalSpent: number;
    invoiceCount: number;
    subscriptionCount: number;
    accountAge: number;
  }> {
    try {
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const stats = await this.customerRepository.getCustomerStats(customerId);
      return {
        ...stats,
        accountAge: Math.floor((Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      };
    } catch (error) {
      logger.error('Failed to get customer stats', { error, customerId });
      throw error;
    }
  }

  async mergeCustomers(primaryCustomerId: string, secondaryCustomerId: string): Promise<Customer> {
    try {
      logger.info('Merging customers', { primaryCustomerId, secondaryCustomerId });

      const [primary, secondary] = await Promise.all([
        this.customerRepository.findById(primaryCustomerId),
        this.customerRepository.findById(secondaryCustomerId),
      ]);

      if (!primary || !secondary) {
        throw new Error('One or both customers not found');
      }

      await this.customerRepository.transferData(secondaryCustomerId, primaryCustomerId);

      const updated = await this.customerRepository.update(primaryCustomerId, {
        metadata: {
          ...primary.metadata,
          mergedFrom: secondaryCustomerId,
          mergedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      });

      await this.customerRepository.delete(secondaryCustomerId);

      logger.info('Customers merged successfully', { primaryCustomerId, secondaryCustomerId });
      return updated!;
    } catch (error) {
      logger.error('Failed to merge customers', { error, primaryCustomerId, secondaryCustomerId });
      throw error;
    }
  }
}

export const customerService = new CustomerService();
