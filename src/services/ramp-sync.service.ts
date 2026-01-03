import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';
import { rampClient } from '../integrations/ramp/ramp.client';
import { RampTransaction, RampBill, RampReimbursement } from '../types/ramp';

export interface SyncResult {
  success: boolean;
  syncedTransactions: number;
  syncedBills: number;
  syncedReimbursements: number;
  errors: SyncError[];
  syncedAt: Date;
}

export interface SyncError {
  type: 'transaction' | 'bill' | 'reimbursement';
  id: string;
  message: string;
  timestamp: Date;
}

export interface TransactionSyncOptions {
  startDate?: Date;
  endDate?: Date;
  includeCleared?: boolean;
  includePending?: boolean;
  batchSize?: number;
}

export interface ProcessedTransaction {
  id: string;
  rampTransactionId: string;
  amount: number;
  currency: string;
  merchantName: string;
  merchantCategory: string;
  cardId: string;
  userId: string;
  state: string;
  syncedAt: Date;
  metadata: Record<string, unknown>;
}

export class RampSyncService {
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  /**
   * Performs a full sync of all Ramp data for a business
   */
  async fullSync(businessId: string, options?: TransactionSyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    logger.info('Starting full Ramp sync', { businessId, options });

    const errors: SyncError[] = [];
    let syncedTransactions = 0;
    let syncedBills = 0;
    let syncedReimbursements = 0;

    try {
      // Sync transactions
      const transactionResult = await this.syncTransactions(businessId, options);
      syncedTransactions = transactionResult.synced;
      errors.push(...transactionResult.errors);

      // Sync bills
      const billResult = await this.syncBills(businessId);
      syncedBills = billResult.synced;
      errors.push(...billResult.errors);

      // Sync reimbursements
      const reimbursementResult = await this.syncReimbursements(businessId);
      syncedReimbursements = reimbursementResult.synced;
      errors.push(...reimbursementResult.errors);

      const duration = Date.now() - startTime;
      logger.info('Full Ramp sync completed', {
        businessId,
        syncedTransactions,
        syncedBills,
        syncedReimbursements,
        errorCount: errors.length,
        durationMs: duration,
      });

      return {
        success: errors.length === 0,
        syncedTransactions,
        syncedBills,
        syncedReimbursements,
        errors,
        syncedAt: new Date(),
      };
    } catch (error) {
      logger.error('Full Ramp sync failed', { error, businessId });
      throw error;
    }
  }

  /**
   * Syncs transactions from Ramp API
   * Optimized for high-volume transaction processing
   */
  async syncTransactions(
    businessId: string,
    options?: TransactionSyncOptions
  ): Promise<{ synced: number; errors: SyncError[] }> {
    const batchSize = options?.batchSize || this.DEFAULT_BATCH_SIZE;
    const errors: SyncError[] = [];
    let synced = 0;
    let cursor: string | undefined;

    logger.info('Starting transaction sync', { businessId, batchSize });

    try {
      do {
        // Fetch transactions from Ramp with pagination
        const params: any = {
          page_size: batchSize,
          start: cursor,
        };

        if (options?.startDate) {
          params.created_after = options.startDate.toISOString();
        }
        if (options?.endDate) {
          params.created_before = options.endDate.toISOString();
        }

        const response = await this.fetchTransactionsWithRetry(businessId, params);

        // Process the transactions from the response
        // The API returns transactions in the 'transactions' field for the v2 endpoint
        const transactions = response.transactions || response.data || [];

        if (!Array.isArray(transactions)) {
          logger.warn('Unexpected transaction response format', { businessId, response: typeof response });
          break;
        }

        for (const transaction of transactions) {
          try {
            // Filter by state if options specified
            if (options?.includeCleared === false && transaction.state === 'cleared') {
              continue;
            }
            if (options?.includePending === false && transaction.state === 'pending') {
              continue;
            }

            await this.processTransaction(transaction);
            synced++;
          } catch (error) {
            const syncError: SyncError = {
              type: 'transaction',
              id: transaction.id,
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            };
            errors.push(syncError);
            logger.error('Failed to process transaction', { error, transactionId: transaction.id });
          }
        }

        // Get next page cursor
        cursor = response.page?.next;

        // Log progress
        logger.debug('Transaction sync progress', { businessId, synced, cursor: !!cursor });

      } while (cursor);

      logger.info('Transaction sync completed', { businessId, synced, errorCount: errors.length });

      return { synced, errors };
    } catch (error) {
      logger.error('Transaction sync failed', { error, businessId });
      throw error;
    }
  }

  /**
   * Fetches transactions with automatic retry on failure
   */
  private async fetchTransactionsWithRetry(
    businessId: string,
    params: any,
    attempt = 1
  ): Promise<any> {
    try {
      return await rampClient.listTransactions(businessId, params);
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        logger.warn('Transaction fetch failed, retrying', { businessId, attempt, maxRetries: this.MAX_RETRIES });
        await this.delay(this.RETRY_DELAY_MS * attempt);
        return this.fetchTransactionsWithRetry(businessId, params, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Processes a single transaction and stores it
   */
  private async processTransaction(transaction: RampTransaction): Promise<ProcessedTransaction> {
    logger.debug('Processing transaction', { transactionId: transaction.id });

    const processed: ProcessedTransaction = {
      id: uuidv4(),
      rampTransactionId: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      merchantName: transaction.merchant_name,
      merchantCategory: transaction.merchant_category_code,
      cardId: transaction.card_id,
      userId: transaction.user_id,
      state: transaction.state,
      syncedAt: new Date(),
      metadata: {
        originalData: transaction,
        syncVersion: '2.0',
      },
    };

    // Here we would normally save to database
    // await this.transactionRepository.upsert(processed);

    return processed;
  }

  /**
   * Syncs bills from Ramp API
   */
  async syncBills(businessId: string): Promise<{ synced: number; errors: SyncError[] }> {
    const errors: SyncError[] = [];
    let synced = 0;
    let cursor: string | undefined;

    logger.info('Starting bill sync', { businessId });

    try {
      do {
        const response = await rampClient.listBills(businessId, {
          page_size: this.DEFAULT_BATCH_SIZE,
          start: cursor,
        });

        const bills = response.data || [];

        for (const bill of bills) {
          try {
            await this.processBill(bill);
            synced++;
          } catch (error) {
            const syncError: SyncError = {
              type: 'bill',
              id: bill.id,
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            };
            errors.push(syncError);
            logger.error('Failed to process bill', { error, billId: bill.id });
          }
        }

        cursor = response.page?.next;
      } while (cursor);

      logger.info('Bill sync completed', { businessId, synced, errorCount: errors.length });

      return { synced, errors };
    } catch (error) {
      logger.error('Bill sync failed', { error, businessId });
      throw error;
    }
  }

  /**
   * Processes a single bill
   */
  private async processBill(bill: RampBill): Promise<void> {
    logger.debug('Processing bill', { billId: bill.id });
    // Process bill logic here
  }

  /**
   * Syncs reimbursements from Ramp API
   */
  async syncReimbursements(businessId: string): Promise<{ synced: number; errors: SyncError[] }> {
    const errors: SyncError[] = [];
    let synced = 0;
    let cursor: string | undefined;

    logger.info('Starting reimbursement sync', { businessId });

    try {
      do {
        const response = await rampClient.listReimbursements(businessId, {
          page_size: this.DEFAULT_BATCH_SIZE,
          start: cursor,
        });

        const reimbursements = response.data || [];

        for (const reimbursement of reimbursements) {
          try {
            await this.processReimbursement(reimbursement);
            synced++;
          } catch (error) {
            const syncError: SyncError = {
              type: 'reimbursement',
              id: reimbursement.id,
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            };
            errors.push(syncError);
            logger.error('Failed to process reimbursement', { error, reimbursementId: reimbursement.id });
          }
        }

        cursor = response.page?.next;
      } while (cursor);

      logger.info('Reimbursement sync completed', { businessId, synced, errorCount: errors.length });

      return { synced, errors };
    } catch (error) {
      logger.error('Reimbursement sync failed', { error, businessId });
      throw error;
    }
  }

  /**
   * Processes a single reimbursement
   */
  private async processReimbursement(reimbursement: RampReimbursement): Promise<void> {
    logger.debug('Processing reimbursement', { reimbursementId: reimbursement.id });
    // Process reimbursement logic here
  }

  /**
   * Performs incremental sync since last sync time
   */
  async incrementalSync(businessId: string, lastSyncTime: Date): Promise<SyncResult> {
    logger.info('Starting incremental Ramp sync', { businessId, lastSyncTime });

    return this.fullSync(businessId, {
      startDate: lastSyncTime,
      endDate: new Date(),
    });
  }

  /**
   * Gets sync status for a business
   */
  async getSyncStatus(businessId: string): Promise<{
    lastSyncAt: Date | null;
    totalTransactions: number;
    totalBills: number;
    totalReimbursements: number;
    syncInProgress: boolean;
  }> {
    // This would normally query the database
    return {
      lastSyncAt: null,
      totalTransactions: 0,
      totalBills: 0,
      totalReimbursements: 0,
      syncInProgress: false,
    };
  }

  /**
   * Validates transaction data integrity
   */
  async validateTransactionIntegrity(businessId: string): Promise<{
    valid: boolean;
    discrepancies: Array<{ transactionId: string; issue: string }>;
  }> {
    const discrepancies: Array<{ transactionId: string; issue: string }> = [];

    try {
      const response = await rampClient.listTransactions(businessId, { page_size: 100 });
      const transactions = response.transactions || response.data || [];

      for (const transaction of transactions) {
        // Validate required fields
        if (!transaction.id) {
          discrepancies.push({ transactionId: 'unknown', issue: 'Missing transaction ID' });
          continue;
        }
        if (!transaction.amount && transaction.amount !== 0) {
          discrepancies.push({ transactionId: transaction.id, issue: 'Missing amount' });
        }
        if (!transaction.merchant_name) {
          discrepancies.push({ transactionId: transaction.id, issue: 'Missing merchant name' });
        }
      }

      return {
        valid: discrepancies.length === 0,
        discrepancies,
      };
    } catch (error) {
      logger.error('Transaction integrity validation failed', { error, businessId });
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const rampSyncService = new RampSyncService();
