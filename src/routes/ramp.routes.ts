import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { rampController } from '../controllers/ramp.controller';

export async function rampRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Business
  fastify.get('/businesses/:businessId', rampController.getBusiness.bind(rampController));

  // Users
  fastify.get('/businesses/:businessId/users', rampController.listUsers.bind(rampController));
  fastify.get('/users/:userId', rampController.getUser.bind(rampController));
  fastify.post('/businesses/:businessId/users', rampController.createUser.bind(rampController));
  fastify.patch('/users/:userId', rampController.updateUser.bind(rampController));
  fastify.post('/users/:userId/deactivate', rampController.deactivateUser.bind(rampController));

  // Cards
  fastify.get('/businesses/:businessId/cards', rampController.listCards.bind(rampController));
  fastify.get('/cards/:cardId', rampController.getCard.bind(rampController));
  fastify.post('/businesses/:businessId/cards', rampController.createCard.bind(rampController));
  fastify.patch('/cards/:cardId', rampController.updateCard.bind(rampController));
  fastify.post('/cards/:cardId/suspend', rampController.suspendCard.bind(rampController));
  fastify.post('/cards/:cardId/unsuspend', rampController.unsuspendCard.bind(rampController));
  fastify.post('/cards/:cardId/terminate', rampController.terminateCard.bind(rampController));

  // Transactions
  fastify.get('/businesses/:businessId/transactions', rampController.listTransactions.bind(rampController));
  fastify.get('/transactions/:transactionId', rampController.getTransaction.bind(rampController));
  fastify.patch('/transactions/:transactionId', rampController.updateTransaction.bind(rampController));

  // Bills
  fastify.get('/businesses/:businessId/bills', rampController.listBills.bind(rampController));
  fastify.get('/bills/:billId', rampController.getBill.bind(rampController));
  fastify.post('/businesses/:businessId/bills', rampController.createBill.bind(rampController));
  fastify.patch('/bills/:billId', rampController.updateBill.bind(rampController));
  fastify.delete('/bills/:billId', rampController.deleteBill.bind(rampController));

  // Reimbursements
  fastify.get('/businesses/:businessId/reimbursements', rampController.listReimbursements.bind(rampController));
  fastify.get('/reimbursements/:reimbursementId', rampController.getReimbursement.bind(rampController));
  fastify.post('/businesses/:businessId/reimbursements', rampController.createReimbursement.bind(rampController));

  // Vendors
  fastify.get('/businesses/:businessId/vendors', rampController.listVendors.bind(rampController));
  fastify.get('/vendors/:vendorId', rampController.getVendor.bind(rampController));
  fastify.post('/businesses/:businessId/vendors', rampController.createVendor.bind(rampController));

  // Departments
  fastify.get('/businesses/:businessId/departments', rampController.listDepartments.bind(rampController));
  fastify.post('/businesses/:businessId/departments', rampController.createDepartment.bind(rampController));

  // Locations
  fastify.get('/businesses/:businessId/locations', rampController.listLocations.bind(rampController));
  fastify.post('/businesses/:businessId/locations', rampController.createLocation.bind(rampController));

  // Card Programs
  fastify.get('/businesses/:businessId/card-programs', rampController.listCardPrograms.bind(rampController));
  fastify.get('/card-programs/:cardProgramId', rampController.getCardProgram.bind(rampController));

  // Spend Programs
  fastify.get('/businesses/:businessId/spend-programs', rampController.listSpendPrograms.bind(rampController));
  fastify.post('/businesses/:businessId/spend-programs', rampController.createSpendProgram.bind(rampController));

  // Statements & Cashback
  fastify.get('/businesses/:businessId/statements', rampController.listStatements.bind(rampController));
  fastify.get('/statements/:statementId', rampController.getStatement.bind(rampController));
  fastify.get('/businesses/:businessId/cashback', rampController.listCashback.bind(rampController));

  // Receipts
  fastify.post('/transactions/:transactionId/receipts', rampController.uploadReceipt.bind(rampController));
  fastify.delete('/transactions/:transactionId/receipts/:receiptId', rampController.deleteReceipt.bind(rampController));

  // Webhooks
  fastify.post('/webhooks/ramp', rampController.handleWebhook.bind(rampController));
}
