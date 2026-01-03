import { FastifyRequest, FastifyReply } from 'fastify';
import { rampClient } from '../integrations/ramp/ramp.client';
import { rampSyncService, TransactionSyncOptions } from '../services/ramp-sync.service';
import { logger } from '../utils/logger';
import {
  RampUser,
  RampCard,
  RampTransaction,
  RampBill,
  RampReimbursement,
  RampVendor,
  RampSpendingRestrictions,
} from '../types/ramp';

interface BusinessParams {
  businessId: string;
}

interface UserParams extends BusinessParams {
  userId: string;
}

interface CardParams extends BusinessParams {
  cardId: string;
}

interface TransactionParams extends BusinessParams {
  transactionId: string;
}

interface BillParams extends BusinessParams {
  billId: string;
}

interface ReimbursementParams extends BusinessParams {
  reimbursementId: string;
}

interface VendorParams extends BusinessParams {
  vendorId: string;
}

interface ListQueryParams {
  start?: string;
  page_size?: number;
  created_after?: string;
  created_before?: string;
}

interface CreateUserBody {
  email: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'bookkeeper' | 'employee';
  department_id?: string;
  location_id?: string;
  manager_id?: string;
  phone?: string;
}

interface CreateCardBody {
  user_id: string;
  display_name: string;
  card_program_id: string;
  spending_restrictions: RampSpendingRestrictions;
  is_physical?: boolean;
}

interface CreateBillBody {
  vendor_id: string;
  vendor_name: string;
  amount: number;
  currency: string;
  due_date: string;
  invoice_number?: string;
  memo?: string;
  line_items: Array<{
    amount: number;
    description: string;
  }>;
}

interface CreateVendorBody {
  name: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  address?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface CreateReimbursementBody {
  user_id: string;
  amount: number;
  currency: string;
  merchant?: string;
  line_items: Array<{
    amount: number;
    currency: string;
    description: string;
  }>;
}

interface UpdateTransactionBody {
  memo?: string;
  sk_category_id?: string;
}

interface CreateDepartmentBody {
  name: string;
  parent_id?: string;
}

interface CreateLocationBody {
  name: string;
  address?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface CreateSpendProgramBody {
  name: string;
  description?: string;
  permitted_spend_types: Array<'card' | 'reimbursement' | 'bill_pay'>;
  spending_restrictions: RampSpendingRestrictions;
  users: string[];
}

export class RampController {
  // ==================== Business ====================

  async getBusiness(
    request: FastifyRequest<{ Params: BusinessParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      logger.info('Getting Ramp business', { businessId });

      const business = await rampClient.getBusiness(businessId);

      return reply.status(200).send({
        success: true,
        data: business,
      });
    } catch (error) {
      logger.error('Failed to get Ramp business', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get business' },
      });
    }
  }

  // ==================== Users ====================

  async listUsers(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp users', { businessId });

      const users = await rampClient.listUsers(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: users.data,
        page: users.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp users', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list users' },
      });
    }
  }

  async getUser(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;
      logger.info('Getting Ramp user', { userId });

      const user = await rampClient.getUser(userId);

      return reply.status(200).send({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Failed to get Ramp user', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get user' },
      });
    }
  }

  async createUser(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateUserBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const userData = request.body;

      logger.info('Creating Ramp user', { businessId, email: userData.email });

      const user = await rampClient.createUser(businessId, userData);

      return reply.status(201).send({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Failed to create Ramp user', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create user' },
      });
    }
  }

  async updateUser(
    request: FastifyRequest<{ Params: UserParams; Body: Partial<CreateUserBody> }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;
      const userData = request.body;

      logger.info('Updating Ramp user', { userId });

      const user = await rampClient.updateUser(userId, userData as Partial<RampUser>);

      return reply.status(200).send({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Failed to update Ramp user', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to update user' },
      });
    }
  }

  async deactivateUser(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;
      logger.info('Deactivating Ramp user', { userId });

      await rampClient.deactivateUser(userId);

      return reply.status(200).send({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      logger.error('Failed to deactivate Ramp user', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to deactivate user' },
      });
    }
  }

  // ==================== Cards ====================

  async listCards(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp cards', { businessId });

      const cards = await rampClient.listCards(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: cards.data,
        page: cards.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp cards', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list cards' },
      });
    }
  }

  async getCard(
    request: FastifyRequest<{ Params: CardParams }>,
    reply: FastifyReply
  ) {
    try {
      const { cardId } = request.params;
      logger.info('Getting Ramp card', { cardId });

      const card = await rampClient.getCard(cardId);

      return reply.status(200).send({
        success: true,
        data: card,
      });
    } catch (error) {
      logger.error('Failed to get Ramp card', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get card' },
      });
    }
  }

  async createCard(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateCardBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { user_id, ...cardData } = request.body;

      logger.info('Creating Ramp card', { businessId, userId: user_id });

      const card = await rampClient.createCard(businessId, user_id, cardData);

      return reply.status(201).send({
        success: true,
        data: card,
      });
    } catch (error) {
      logger.error('Failed to create Ramp card', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create card' },
      });
    }
  }

  async updateCard(
    request: FastifyRequest<{ Params: CardParams; Body: Partial<RampCard> }>,
    reply: FastifyReply
  ) {
    try {
      const { cardId } = request.params;
      const cardData = request.body;

      logger.info('Updating Ramp card', { cardId });

      const card = await rampClient.updateCard(cardId, cardData);

      return reply.status(200).send({
        success: true,
        data: card,
      });
    } catch (error) {
      logger.error('Failed to update Ramp card', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to update card' },
      });
    }
  }

  async suspendCard(
    request: FastifyRequest<{ Params: CardParams }>,
    reply: FastifyReply
  ) {
    try {
      const { cardId } = request.params;
      logger.info('Suspending Ramp card', { cardId });

      const card = await rampClient.suspendCard(cardId);

      return reply.status(200).send({
        success: true,
        data: card,
      });
    } catch (error) {
      logger.error('Failed to suspend Ramp card', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to suspend card' },
      });
    }
  }

  async unsuspendCard(
    request: FastifyRequest<{ Params: CardParams }>,
    reply: FastifyReply
  ) {
    try {
      const { cardId } = request.params;
      logger.info('Unsuspending Ramp card', { cardId });

      const card = await rampClient.unsuspendCard(cardId);

      return reply.status(200).send({
        success: true,
        data: card,
      });
    } catch (error) {
      logger.error('Failed to unsuspend Ramp card', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to unsuspend card' },
      });
    }
  }

  async terminateCard(
    request: FastifyRequest<{ Params: CardParams }>,
    reply: FastifyReply
  ) {
    try {
      const { cardId } = request.params;
      logger.info('Terminating Ramp card', { cardId });

      await rampClient.terminateCard(cardId);

      return reply.status(200).send({
        success: true,
        message: 'Card terminated successfully',
      });
    } catch (error) {
      logger.error('Failed to terminate Ramp card', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to terminate card' },
      });
    }
  }

  // ==================== Transactions ====================

  async listTransactions(
    request: FastifyRequest<{
      Params: BusinessParams;
      Querystring: ListQueryParams & { user_id?: string; card_id?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before, user_id, card_id } = request.query;

      logger.info('Listing Ramp transactions', { businessId });

      const transactions = await rampClient.listTransactions(businessId, {
        start,
        page_size,
        created_after,
        created_before,
        user_id,
        card_id,
      });

      return reply.status(200).send({
        success: true,
        data: transactions.data,
        page: transactions.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp transactions', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list transactions' },
      });
    }
  }

  async getTransaction(
    request: FastifyRequest<{ Params: TransactionParams }>,
    reply: FastifyReply
  ) {
    try {
      const { transactionId } = request.params;
      logger.info('Getting Ramp transaction', { transactionId });

      const transaction = await rampClient.getTransaction(transactionId);

      return reply.status(200).send({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Failed to get Ramp transaction', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get transaction' },
      });
    }
  }

  async updateTransaction(
    request: FastifyRequest<{ Params: TransactionParams; Body: UpdateTransactionBody }>,
    reply: FastifyReply
  ) {
    try {
      const { transactionId } = request.params;
      const data = request.body;

      logger.info('Updating Ramp transaction', { transactionId });

      const transaction = await rampClient.updateTransaction(transactionId, data);

      return reply.status(200).send({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Failed to update Ramp transaction', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to update transaction' },
      });
    }
  }

  // ==================== Bills ====================

  async listBills(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp bills', { businessId });

      const bills = await rampClient.listBills(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: bills.data,
        page: bills.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp bills', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list bills' },
      });
    }
  }

  async getBill(
    request: FastifyRequest<{ Params: BillParams }>,
    reply: FastifyReply
  ) {
    try {
      const { billId } = request.params;
      logger.info('Getting Ramp bill', { billId });

      const bill = await rampClient.getBill(billId);

      return reply.status(200).send({
        success: true,
        data: bill,
      });
    } catch (error) {
      logger.error('Failed to get Ramp bill', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get bill' },
      });
    }
  }

  async createBill(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateBillBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const billData = request.body;

      logger.info('Creating Ramp bill', { businessId });

      const bill = await rampClient.createBill(businessId, billData as Partial<RampBill>);

      return reply.status(201).send({
        success: true,
        data: bill,
      });
    } catch (error) {
      logger.error('Failed to create Ramp bill', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create bill' },
      });
    }
  }

  async updateBill(
    request: FastifyRequest<{ Params: BillParams; Body: Partial<CreateBillBody> }>,
    reply: FastifyReply
  ) {
    try {
      const { billId } = request.params;
      const billData = request.body;

      logger.info('Updating Ramp bill', { billId });

      const bill = await rampClient.updateBill(billId, billData as Partial<RampBill>);

      return reply.status(200).send({
        success: true,
        data: bill,
      });
    } catch (error) {
      logger.error('Failed to update Ramp bill', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to update bill' },
      });
    }
  }

  async deleteBill(
    request: FastifyRequest<{ Params: BillParams }>,
    reply: FastifyReply
  ) {
    try {
      const { billId } = request.params;
      logger.info('Deleting Ramp bill', { billId });

      await rampClient.deleteBill(billId);

      return reply.status(200).send({
        success: true,
        message: 'Bill deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete Ramp bill', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to delete bill' },
      });
    }
  }

  // ==================== Reimbursements ====================

  async listReimbursements(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp reimbursements', { businessId });

      const reimbursements = await rampClient.listReimbursements(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: reimbursements.data,
        page: reimbursements.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp reimbursements', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list reimbursements' },
      });
    }
  }

  async getReimbursement(
    request: FastifyRequest<{ Params: ReimbursementParams }>,
    reply: FastifyReply
  ) {
    try {
      const { reimbursementId } = request.params;
      logger.info('Getting Ramp reimbursement', { reimbursementId });

      const reimbursement = await rampClient.getReimbursement(reimbursementId);

      return reply.status(200).send({
        success: true,
        data: reimbursement,
      });
    } catch (error) {
      logger.error('Failed to get Ramp reimbursement', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get reimbursement' },
      });
    }
  }

  async createReimbursement(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateReimbursementBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const data = request.body;

      logger.info('Creating Ramp reimbursement', { businessId });

      const reimbursement = await rampClient.createReimbursement(businessId, data as Partial<RampReimbursement>);

      return reply.status(201).send({
        success: true,
        data: reimbursement,
      });
    } catch (error) {
      logger.error('Failed to create Ramp reimbursement', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create reimbursement' },
      });
    }
  }

  // ==================== Vendors ====================

  async listVendors(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp vendors', { businessId });

      const vendors = await rampClient.listVendors(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: vendors.data,
        page: vendors.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp vendors', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list vendors' },
      });
    }
  }

  async getVendor(
    request: FastifyRequest<{ Params: VendorParams }>,
    reply: FastifyReply
  ) {
    try {
      const { vendorId } = request.params;
      logger.info('Getting Ramp vendor', { vendorId });

      const vendor = await rampClient.getVendor(vendorId);

      return reply.status(200).send({
        success: true,
        data: vendor,
      });
    } catch (error) {
      logger.error('Failed to get Ramp vendor', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get vendor' },
      });
    }
  }

  async createVendor(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateVendorBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const vendorData = request.body;

      logger.info('Creating Ramp vendor', { businessId });

      const vendor = await rampClient.createVendor(businessId, vendorData as Partial<RampVendor>);

      return reply.status(201).send({
        success: true,
        data: vendor,
      });
    } catch (error) {
      logger.error('Failed to create Ramp vendor', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create vendor' },
      });
    }
  }

  // ==================== Departments ====================

  async listDepartments(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp departments', { businessId });

      const departments = await rampClient.listDepartments(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: departments.data,
        page: departments.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp departments', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list departments' },
      });
    }
  }

  async createDepartment(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateDepartmentBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { name, parent_id } = request.body;

      logger.info('Creating Ramp department', { businessId, name });

      const department = await rampClient.createDepartment(businessId, name, parent_id);

      return reply.status(201).send({
        success: true,
        data: department,
      });
    } catch (error) {
      logger.error('Failed to create Ramp department', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create department' },
      });
    }
  }

  // ==================== Locations ====================

  async listLocations(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp locations', { businessId });

      const locations = await rampClient.listLocations(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: locations.data,
        page: locations.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp locations', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list locations' },
      });
    }
  }

  async createLocation(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateLocationBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const locationData = request.body;

      logger.info('Creating Ramp location', { businessId });

      const location = await rampClient.createLocation(businessId, locationData);

      return reply.status(201).send({
        success: true,
        data: location,
      });
    } catch (error) {
      logger.error('Failed to create Ramp location', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create location' },
      });
    }
  }

  // ==================== Card Programs ====================

  async listCardPrograms(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp card programs', { businessId });

      const programs = await rampClient.listCardPrograms(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: programs.data,
        page: programs.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp card programs', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list card programs' },
      });
    }
  }

  async getCardProgram(
    request: FastifyRequest<{ Params: { cardProgramId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { cardProgramId } = request.params;
      logger.info('Getting Ramp card program', { cardProgramId });

      const program = await rampClient.getCardProgram(cardProgramId);

      return reply.status(200).send({
        success: true,
        data: program,
      });
    } catch (error) {
      logger.error('Failed to get Ramp card program', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get card program' },
      });
    }
  }

  // ==================== Spend Programs ====================

  async listSpendPrograms(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp spend programs', { businessId });

      const programs = await rampClient.listSpendPrograms(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: programs.data,
        page: programs.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp spend programs', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list spend programs' },
      });
    }
  }

  async createSpendProgram(
    request: FastifyRequest<{ Params: BusinessParams; Body: CreateSpendProgramBody }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const programData = request.body;

      logger.info('Creating Ramp spend program', { businessId });

      const program = await rampClient.createSpendProgram(businessId, programData);

      return reply.status(201).send({
        success: true,
        data: program,
      });
    } catch (error) {
      logger.error('Failed to create Ramp spend program', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to create spend program' },
      });
    }
  }

  // ==================== Statements & Cashback ====================

  async listStatements(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp statements', { businessId });

      const statements = await rampClient.listStatements(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: statements.data,
        page: statements.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp statements', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list statements' },
      });
    }
  }

  async getStatement(
    request: FastifyRequest<{ Params: { statementId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { statementId } = request.params;
      logger.info('Getting Ramp statement', { statementId });

      const statement = await rampClient.getStatement(statementId);

      return reply.status(200).send({
        success: true,
        data: statement,
      });
    } catch (error) {
      logger.error('Failed to get Ramp statement', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to get statement' },
      });
    }
  }

  async listCashback(
    request: FastifyRequest<{ Params: BusinessParams; Querystring: ListQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { start, page_size, created_after, created_before } = request.query;

      logger.info('Listing Ramp cashback', { businessId });

      const cashback = await rampClient.listCashback(businessId, {
        start,
        page_size,
        created_after,
        created_before,
      });

      return reply.status(200).send({
        success: true,
        data: cashback.data,
        page: cashback.page,
      });
    } catch (error) {
      logger.error('Failed to list Ramp cashback', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to list cashback' },
      });
    }
  }

  // ==================== Receipts ====================

  async uploadReceipt(
    request: FastifyRequest<{ Params: TransactionParams; Body: { file: Buffer; contentType: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { transactionId } = request.params;
      const { file, contentType } = request.body;

      logger.info('Uploading receipt to Ramp transaction', { transactionId });

      await rampClient.uploadReceipt(transactionId, file, contentType);

      return reply.status(201).send({
        success: true,
        message: 'Receipt uploaded successfully',
      });
    } catch (error) {
      logger.error('Failed to upload receipt', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to upload receipt' },
      });
    }
  }

  async deleteReceipt(
    request: FastifyRequest<{ Params: TransactionParams & { receiptId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { transactionId, receiptId } = request.params;
      logger.info('Deleting receipt from Ramp transaction', { transactionId, receiptId });

      await rampClient.deleteReceipt(transactionId, receiptId);

      return reply.status(200).send({
        success: true,
        message: 'Receipt deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete receipt', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'RAMP_ERROR', message: 'Failed to delete receipt' },
      });
    }
  }

  // ==================== Webhooks ====================

  async handleWebhook(
    request: FastifyRequest<{ Body: any; Headers: { 'x-ramp-signature': string } }>,
    reply: FastifyReply
  ) {
    try {
      const signature = request.headers['x-ramp-signature'];
      const payload = JSON.stringify(request.body);

      const isValid = rampClient.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        logger.warn('Invalid Ramp webhook signature');
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
        });
      }

      const event = request.body;
      logger.info('Received Ramp webhook', { type: event.type, id: event.id });

      switch (event.type) {
        case 'transaction.created':
        case 'transaction.updated':
          await this.handleTransactionEvent(event);
          break;
        case 'card.created':
        case 'card.updated':
        case 'card.suspended':
        case 'card.terminated':
          await this.handleCardEvent(event);
          break;
        case 'user.created':
        case 'user.updated':
          await this.handleUserEvent(event);
          break;
        case 'reimbursement.created':
        case 'reimbursement.updated':
          await this.handleReimbursementEvent(event);
          break;
        case 'bill.created':
        case 'bill.updated':
        case 'bill.paid':
          await this.handleBillEvent(event);
          break;
        default:
          logger.warn('Unhandled Ramp webhook event type', { type: event.type });
      }

      return reply.status(200).send({ received: true });
    } catch (error) {
      logger.error('Failed to handle Ramp webhook', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook' },
      });
    }
  }

  private async handleTransactionEvent(event: any): Promise<void> {
    logger.info('Handling transaction event', { type: event.type, transactionId: event.data?.id });
  }

  private async handleCardEvent(event: any): Promise<void> {
    logger.info('Handling card event', { type: event.type, cardId: event.data?.id });
  }

  private async handleUserEvent(event: any): Promise<void> {
    logger.info('Handling user event', { type: event.type, userId: event.data?.id });
  }

  private async handleReimbursementEvent(event: any): Promise<void> {
    logger.info('Handling reimbursement event', { type: event.type, reimbursementId: event.data?.id });
  }

  private async handleBillEvent(event: any): Promise<void> {
    logger.info('Handling bill event', { type: event.type, billId: event.data?.id });
  }

  // ==================== Data Sync Operations ====================

  /**
   * Performs a full synchronization of all Ramp data for a business.
   * This endpoint fetches and stores all transactions, bills, and reimbursements.
   *
   * Note: This is an expensive operation and should be used sparingly.
   * For regular updates, use the incremental sync endpoint instead.
   */
  async fullSync(
    request: FastifyRequest<{
      Params: BusinessParams;
      Body: {
        startDate?: string;
        endDate?: string;
        includeCleared?: boolean;
        includePending?: boolean;
        batchSize?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { startDate, endDate, includeCleared, includePending, batchSize } = request.body || {};

      logger.info('Starting full Ramp data sync', { businessId });

      const options: TransactionSyncOptions = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        includeCleared: includeCleared ?? true,
        includePending: includePending ?? true,
        batchSize: batchSize || 100,
      };

      const result = await rampSyncService.fullSync(businessId, options);

      logger.info('Full sync completed', {
        businessId,
        syncedTransactions: result.syncedTransactions,
        syncedBills: result.syncedBills,
        syncedReimbursements: result.syncedReimbursements,
        errorCount: result.errors.length,
      });

      return reply.status(200).send({
        success: result.success,
        data: {
          syncedTransactions: result.syncedTransactions,
          syncedBills: result.syncedBills,
          syncedReimbursements: result.syncedReimbursements,
          syncedAt: result.syncedAt,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      });
    } catch (error) {
      logger.error('Full sync failed', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SYNC_ERROR', message: 'Failed to perform full sync' },
      });
    }
  }

  /**
   * Performs an incremental sync since the last sync time.
   * This is more efficient than a full sync for regular updates.
   */
  async incrementalSync(
    request: FastifyRequest<{
      Params: BusinessParams;
      Body: { lastSyncTime: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { lastSyncTime } = request.body;

      if (!lastSyncTime) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'lastSyncTime is required' },
        });
      }

      logger.info('Starting incremental Ramp sync', { businessId, lastSyncTime });

      const result = await rampSyncService.incrementalSync(businessId, new Date(lastSyncTime));

      logger.info('Incremental sync completed', {
        businessId,
        syncedTransactions: result.syncedTransactions,
        syncedBills: result.syncedBills,
        syncedReimbursements: result.syncedReimbursements,
      });

      return reply.status(200).send({
        success: result.success,
        data: {
          syncedTransactions: result.syncedTransactions,
          syncedBills: result.syncedBills,
          syncedReimbursements: result.syncedReimbursements,
          syncedAt: result.syncedAt,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      });
    } catch (error) {
      logger.error('Incremental sync failed', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SYNC_ERROR', message: 'Failed to perform incremental sync' },
      });
    }
  }

  /**
   * Gets the current sync status for a business.
   * Returns information about the last sync time and totals.
   */
  async getSyncStatus(
    request: FastifyRequest<{ Params: BusinessParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;

      logger.info('Getting sync status', { businessId });

      const status = await rampSyncService.getSyncStatus(businessId);

      return reply.status(200).send({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get sync status', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SYNC_ERROR', message: 'Failed to get sync status' },
      });
    }
  }

  /**
   * Validates the integrity of synced transaction data.
   * Compares local data against the Ramp API to detect discrepancies.
   */
  async validateTransactionIntegrity(
    request: FastifyRequest<{ Params: BusinessParams }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;

      logger.info('Validating transaction integrity', { businessId });

      const result = await rampSyncService.validateTransactionIntegrity(businessId);

      return reply.status(200).send({
        success: true,
        data: {
          valid: result.valid,
          discrepancyCount: result.discrepancies.length,
          discrepancies: result.discrepancies.length > 0 ? result.discrepancies : undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to validate transaction integrity', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Failed to validate transaction integrity' },
      });
    }
  }

  /**
   * Syncs only transactions for a business.
   * Useful when you only need transaction data without bills/reimbursements.
   */
  async syncTransactionsOnly(
    request: FastifyRequest<{
      Params: BusinessParams;
      Body: {
        startDate?: string;
        endDate?: string;
        includeCleared?: boolean;
        includePending?: boolean;
        batchSize?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { businessId } = request.params;
      const { startDate, endDate, includeCleared, includePending, batchSize } = request.body || {};

      logger.info('Starting transaction-only sync', { businessId });

      const options: TransactionSyncOptions = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        includeCleared: includeCleared ?? true,
        includePending: includePending ?? true,
        batchSize: batchSize || 100,
      };

      const result = await rampSyncService.syncTransactions(businessId, options);

      logger.info('Transaction sync completed', {
        businessId,
        synced: result.synced,
        errorCount: result.errors.length,
      });

      return reply.status(200).send({
        success: result.errors.length === 0,
        data: {
          syncedTransactions: result.synced,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      });
    } catch (error) {
      logger.error('Transaction sync failed', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'SYNC_ERROR', message: 'Failed to sync transactions' },
      });
    }
  }
}

export const rampController = new RampController();
