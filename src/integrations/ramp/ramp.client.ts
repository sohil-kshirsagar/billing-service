import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import {
  RampBusiness,
  RampUser,
  RampCard,
  RampTransaction,
  RampReimbursement,
  RampBill,
  RampVendor,
  RampDepartment,
  RampLocation,
  RampCardProgram,
  RampSpendProgram,
  RampCashback,
  RampStatement,
  RampApiResponse,
  RampListParams,
  RampTokenResponse,
  RampSpendingRestrictions,
} from '../../types/ramp';

export class RampClient {
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.ramp.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.httpClient.interceptors.request.use(async (requestConfig) => {
      const token = await this.getAccessToken();
      requestConfig.headers.Authorization = `Bearer ${token}`;
      return requestConfig;
    });

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Ramp API error', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        throw error;
      }
    );
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<RampTokenResponse>(
        'https://api.ramp.com/developer/v1/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.ramp.clientId,
          client_secret: config.ramp.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
      logger.info('Ramp access token refreshed');

      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get Ramp access token', { error });
      throw error;
    }
  }

  // Business Methods
  async getBusiness(businessId: string): Promise<RampBusiness> {
    try {
      const response = await this.httpClient.get<RampBusiness>(`/businesses/${businessId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp business', { error, businessId });
      throw error;
    }
  }

  // User Methods
  async listUsers(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampUser[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampUser[]>>(`/businesses/${businessId}/users`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp users', { error, businessId });
      throw error;
    }
  }

  async getUser(userId: string): Promise<RampUser> {
    try {
      const response = await this.httpClient.get<RampUser>(`/users/${userId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp user', { error, userId });
      throw error;
    }
  }

  async createUser(businessId: string, userData: Partial<RampUser>): Promise<RampUser> {
    try {
      logger.info('Creating Ramp user', { businessId, email: userData.email });
      const response = await this.httpClient.post<RampUser>(`/businesses/${businessId}/users`, userData);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp user', { error, businessId });
      throw error;
    }
  }

  async updateUser(userId: string, userData: Partial<RampUser>): Promise<RampUser> {
    try {
      logger.info('Updating Ramp user', { userId });
      const response = await this.httpClient.patch<RampUser>(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      logger.error('Failed to update Ramp user', { error, userId });
      throw error;
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    try {
      logger.info('Deactivating Ramp user', { userId });
      await this.httpClient.post(`/users/${userId}/deactivate`);
    } catch (error) {
      logger.error('Failed to deactivate Ramp user', { error, userId });
      throw error;
    }
  }

  // Card Methods
  async listCards(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampCard[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampCard[]>>(`/businesses/${businessId}/cards`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp cards', { error, businessId });
      throw error;
    }
  }

  async getCard(cardId: string): Promise<RampCard> {
    try {
      const response = await this.httpClient.get<RampCard>(`/cards/${cardId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp card', { error, cardId });
      throw error;
    }
  }

  async createCard(
    businessId: string,
    userId: string,
    cardData: {
      display_name: string;
      card_program_id: string;
      spending_restrictions: RampSpendingRestrictions;
      is_physical?: boolean;
    }
  ): Promise<RampCard> {
    try {
      logger.info('Creating Ramp card', { businessId, userId });
      const response = await this.httpClient.post<RampCard>(`/businesses/${businessId}/cards`, {
        user_id: userId,
        ...cardData,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp card', { error, businessId });
      throw error;
    }
  }

  async updateCard(cardId: string, cardData: Partial<RampCard>): Promise<RampCard> {
    try {
      logger.info('Updating Ramp card', { cardId });
      const response = await this.httpClient.patch<RampCard>(`/cards/${cardId}`, cardData);
      return response.data;
    } catch (error) {
      logger.error('Failed to update Ramp card', { error, cardId });
      throw error;
    }
  }

  async suspendCard(cardId: string): Promise<RampCard> {
    try {
      logger.info('Suspending Ramp card', { cardId });
      const response = await this.httpClient.post<RampCard>(`/cards/${cardId}/suspend`);
      return response.data;
    } catch (error) {
      logger.error('Failed to suspend Ramp card', { error, cardId });
      throw error;
    }
  }

  async unsuspendCard(cardId: string): Promise<RampCard> {
    try {
      logger.info('Unsuspending Ramp card', { cardId });
      const response = await this.httpClient.post<RampCard>(`/cards/${cardId}/unsuspend`);
      return response.data;
    } catch (error) {
      logger.error('Failed to unsuspend Ramp card', { error, cardId });
      throw error;
    }
  }

  async terminateCard(cardId: string): Promise<void> {
    try {
      logger.info('Terminating Ramp card', { cardId });
      await this.httpClient.post(`/cards/${cardId}/terminate`);
    } catch (error) {
      logger.error('Failed to terminate Ramp card', { error, cardId });
      throw error;
    }
  }

  // Transaction Methods
  async listTransactions(businessId: string, params?: RampListParams & { user_id?: string; card_id?: string }): Promise<RampApiResponse<RampTransaction[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampTransaction[]>>(`/businesses/${businessId}/transactions`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp transactions', { error, businessId });
      throw error;
    }
  }

  async getTransaction(transactionId: string): Promise<RampTransaction> {
    try {
      const response = await this.httpClient.get<RampTransaction>(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp transaction', { error, transactionId });
      throw error;
    }
  }

  async updateTransaction(transactionId: string, data: { memo?: string; sk_category_id?: string }): Promise<RampTransaction> {
    try {
      logger.info('Updating Ramp transaction', { transactionId });
      const response = await this.httpClient.patch<RampTransaction>(`/transactions/${transactionId}`, data);
      return response.data;
    } catch (error) {
      logger.error('Failed to update Ramp transaction', { error, transactionId });
      throw error;
    }
  }

  // Reimbursement Methods
  async listReimbursements(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampReimbursement[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampReimbursement[]>>(`/businesses/${businessId}/reimbursements`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp reimbursements', { error, businessId });
      throw error;
    }
  }

  async getReimbursement(reimbursementId: string): Promise<RampReimbursement> {
    try {
      const response = await this.httpClient.get<RampReimbursement>(`/reimbursements/${reimbursementId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp reimbursement', { error, reimbursementId });
      throw error;
    }
  }

  async createReimbursement(businessId: string, data: Partial<RampReimbursement>): Promise<RampReimbursement> {
    try {
      logger.info('Creating Ramp reimbursement', { businessId });
      const response = await this.httpClient.post<RampReimbursement>(`/businesses/${businessId}/reimbursements`, data);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp reimbursement', { error, businessId });
      throw error;
    }
  }

  // Bill Methods
  async listBills(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampBill[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampBill[]>>(`/businesses/${businessId}/bills`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp bills', { error, businessId });
      throw error;
    }
  }

  async getBill(billId: string): Promise<RampBill> {
    try {
      const response = await this.httpClient.get<RampBill>(`/bills/${billId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp bill', { error, billId });
      throw error;
    }
  }

  async createBill(businessId: string, billData: Partial<RampBill>): Promise<RampBill> {
    try {
      logger.info('Creating Ramp bill', { businessId });
      const response = await this.httpClient.post<RampBill>(`/businesses/${businessId}/bills`, billData);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp bill', { error, businessId });
      throw error;
    }
  }

  async updateBill(billId: string, billData: Partial<RampBill>): Promise<RampBill> {
    try {
      logger.info('Updating Ramp bill', { billId });
      const response = await this.httpClient.patch<RampBill>(`/bills/${billId}`, billData);
      return response.data;
    } catch (error) {
      logger.error('Failed to update Ramp bill', { error, billId });
      throw error;
    }
  }

  async deleteBill(billId: string): Promise<void> {
    try {
      logger.info('Deleting Ramp bill', { billId });
      await this.httpClient.delete(`/bills/${billId}`);
    } catch (error) {
      logger.error('Failed to delete Ramp bill', { error, billId });
      throw error;
    }
  }

  // Vendor Methods
  async listVendors(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampVendor[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampVendor[]>>(`/businesses/${businessId}/vendors`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp vendors', { error, businessId });
      throw error;
    }
  }

  async getVendor(vendorId: string): Promise<RampVendor> {
    try {
      const response = await this.httpClient.get<RampVendor>(`/vendors/${vendorId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp vendor', { error, vendorId });
      throw error;
    }
  }

  async createVendor(businessId: string, vendorData: Partial<RampVendor>): Promise<RampVendor> {
    try {
      logger.info('Creating Ramp vendor', { businessId });
      const response = await this.httpClient.post<RampVendor>(`/businesses/${businessId}/vendors`, vendorData);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp vendor', { error, businessId });
      throw error;
    }
  }

  // Department Methods
  async listDepartments(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampDepartment[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampDepartment[]>>(`/businesses/${businessId}/departments`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp departments', { error, businessId });
      throw error;
    }
  }

  async createDepartment(businessId: string, name: string, parentId?: string): Promise<RampDepartment> {
    try {
      logger.info('Creating Ramp department', { businessId, name });
      const response = await this.httpClient.post<RampDepartment>(`/businesses/${businessId}/departments`, {
        name,
        parent_id: parentId,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp department', { error, businessId });
      throw error;
    }
  }

  // Location Methods
  async listLocations(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampLocation[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampLocation[]>>(`/businesses/${businessId}/locations`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp locations', { error, businessId });
      throw error;
    }
  }

  async createLocation(businessId: string, locationData: Partial<RampLocation>): Promise<RampLocation> {
    try {
      logger.info('Creating Ramp location', { businessId });
      const response = await this.httpClient.post<RampLocation>(`/businesses/${businessId}/locations`, locationData);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp location', { error, businessId });
      throw error;
    }
  }

  // Card Program Methods
  async listCardPrograms(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampCardProgram[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampCardProgram[]>>(`/businesses/${businessId}/card-programs`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp card programs', { error, businessId });
      throw error;
    }
  }

  async getCardProgram(cardProgramId: string): Promise<RampCardProgram> {
    try {
      const response = await this.httpClient.get<RampCardProgram>(`/card-programs/${cardProgramId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp card program', { error, cardProgramId });
      throw error;
    }
  }

  // Spend Program Methods
  async listSpendPrograms(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampSpendProgram[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampSpendProgram[]>>(`/businesses/${businessId}/spend-programs`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp spend programs', { error, businessId });
      throw error;
    }
  }

  async createSpendProgram(businessId: string, programData: Partial<RampSpendProgram>): Promise<RampSpendProgram> {
    try {
      logger.info('Creating Ramp spend program', { businessId });
      const response = await this.httpClient.post<RampSpendProgram>(`/businesses/${businessId}/spend-programs`, programData);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Ramp spend program', { error, businessId });
      throw error;
    }
  }

  // Cashback Methods
  async listCashback(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampCashback[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampCashback[]>>(`/businesses/${businessId}/cashback`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp cashback', { error, businessId });
      throw error;
    }
  }

  // Statement Methods
  async listStatements(businessId: string, params?: RampListParams): Promise<RampApiResponse<RampStatement[]>> {
    try {
      const response = await this.httpClient.get<RampApiResponse<RampStatement[]>>(`/businesses/${businessId}/statements`, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list Ramp statements', { error, businessId });
      throw error;
    }
  }

  async getStatement(statementId: string): Promise<RampStatement> {
    try {
      const response = await this.httpClient.get<RampStatement>(`/statements/${statementId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Ramp statement', { error, statementId });
      throw error;
    }
  }

  // Receipt Methods
  async uploadReceipt(transactionId: string, file: Buffer, contentType: string): Promise<void> {
    try {
      logger.info('Uploading receipt to Ramp transaction', { transactionId });
      await this.httpClient.post(`/transactions/${transactionId}/receipts`, file, {
        headers: {
          'Content-Type': contentType,
        },
      });
    } catch (error) {
      logger.error('Failed to upload receipt', { error, transactionId });
      throw error;
    }
  }

  async deleteReceipt(transactionId: string, receiptId: string): Promise<void> {
    try {
      logger.info('Deleting receipt from Ramp transaction', { transactionId, receiptId });
      await this.httpClient.delete(`/transactions/${transactionId}/receipts/${receiptId}`);
    } catch (error) {
      logger.error('Failed to delete receipt', { error, transactionId, receiptId });
      throw error;
    }
  }

  // Webhook Verification
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.ramp.webhookSecret)
        .update(payload)
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      logger.error('Failed to verify Ramp webhook signature', { error });
      return false;
    }
  }
}

export const rampClient = new RampClient();
