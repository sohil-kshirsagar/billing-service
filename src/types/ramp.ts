export interface RampBusiness {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RampUser {
  id: string;
  business_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RampUserRole;
  status: RampUserStatus;
  department_id?: string;
  location_id?: string;
  manager_id?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export type RampUserRole = 'owner' | 'admin' | 'bookkeeper' | 'employee';
export type RampUserStatus = 'active' | 'invite_pending' | 'suspended' | 'deactivated';

export interface RampCard {
  id: string;
  business_id: string;
  user_id: string;
  display_name: string;
  last_four: string;
  cardholder_name: string;
  card_program_id: string;
  spending_restrictions: RampSpendingRestrictions;
  state: RampCardState;
  is_physical: boolean;
  created_at: string;
  updated_at: string;
}

export type RampCardState = 'active' | 'suspended' | 'terminated';

export interface RampSpendingRestrictions {
  amount: number;
  interval: RampSpendingInterval;
  lock_date?: string;
  categories?: RampCategory[];
  blocked_categories?: RampCategory[];
  vendors?: string[];
  blocked_vendors?: string[];
  transaction_amount_limit?: number;
}

export type RampSpendingInterval = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

export interface RampCategory {
  code: string;
  name: string;
}

export interface RampTransaction {
  id: string;
  business_id: string;
  card_id: string;
  user_id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_category_code: string;
  amount: number;
  currency: string;
  state: RampTransactionState;
  sk_category_id?: string;
  sk_category_name?: string;
  receipts: RampReceipt[];
  memo?: string;
  accounting_field_selections?: RampAccountingFieldSelection[];
  created_at: string;
  updated_at: string;
}

export type RampTransactionState = 'pending' | 'cleared' | 'declined' | 'reversed';

export interface RampReceipt {
  id: string;
  transaction_id: string;
  user_id: string;
  content_type: string;
  created_at: string;
}

export interface RampAccountingFieldSelection {
  id: string;
  name: string;
  external_id?: string;
}

export interface RampReimbursement {
  id: string;
  business_id: string;
  user_id: string;
  amount: number;
  currency: string;
  state: RampReimbursementState;
  merchant?: string;
  line_items: RampReimbursementLineItem[];
  receipts: RampReceipt[];
  created_at: string;
  updated_at: string;
}

export type RampReimbursementState = 'pending' | 'approved' | 'rejected' | 'paid';

export interface RampReimbursementLineItem {
  amount: number;
  currency: string;
  description: string;
}

export interface RampBill {
  id: string;
  business_id: string;
  vendor_id: string;
  vendor_name: string;
  amount: number;
  currency: string;
  due_date: string;
  invoice_number?: string;
  status: RampBillStatus;
  payment_status: RampBillPaymentStatus;
  memo?: string;
  line_items: RampBillLineItem[];
  created_at: string;
  updated_at: string;
}

export type RampBillStatus = 'draft' | 'open' | 'closed' | 'void';
export type RampBillPaymentStatus = 'unpaid' | 'scheduled' | 'paid' | 'partially_paid';

export interface RampBillLineItem {
  id: string;
  amount: number;
  description: string;
  accounting_field_selections?: RampAccountingFieldSelection[];
}

export interface RampVendor {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: RampAddress;
  tax_id?: string;
  payment_method?: RampVendorPaymentMethod;
  created_at: string;
  updated_at: string;
}

export interface RampAddress {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface RampVendorPaymentMethod {
  type: 'ach' | 'check' | 'wire';
  bank_name?: string;
  account_number_last_four?: string;
  routing_number_last_four?: string;
}

export interface RampDepartment {
  id: string;
  business_id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RampLocation {
  id: string;
  business_id: string;
  name: string;
  address?: RampAddress;
  created_at: string;
  updated_at: string;
}

export interface RampCardProgram {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  icon: string;
  is_default: boolean;
  is_physical: boolean;
  spending_restrictions: RampSpendingRestrictions;
  created_at: string;
  updated_at: string;
}

export interface RampWebhookEvent {
  id: string;
  type: RampWebhookEventType;
  business_id: string;
  data: Record<string, unknown>;
  created_at: string;
}

export type RampWebhookEventType =
  | 'transaction.created'
  | 'transaction.updated'
  | 'card.created'
  | 'card.updated'
  | 'card.suspended'
  | 'card.terminated'
  | 'user.created'
  | 'user.updated'
  | 'reimbursement.created'
  | 'reimbursement.updated'
  | 'bill.created'
  | 'bill.updated'
  | 'bill.paid';

export interface RampApiResponse<T> {
  data: T;
  page?: {
    next?: string;
  };
}

export interface RampListParams {
  start?: string;
  page_size?: number;
  created_after?: string;
  created_before?: string;
}

export interface RampTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface RampSpendProgram {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  permitted_spend_types: RampSpendType[];
  spending_restrictions: RampSpendingRestrictions;
  users: string[];
  created_at: string;
  updated_at: string;
}

export type RampSpendType = 'card' | 'reimbursement' | 'bill_pay';

export interface RampCashback {
  id: string;
  business_id: string;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  status: RampCashbackStatus;
  created_at: string;
}

export type RampCashbackStatus = 'pending' | 'paid';

export interface RampStatement {
  id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  currency: string;
  due_date: string;
  status: RampStatementStatus;
  pdf_url?: string;
  created_at: string;
}

export type RampStatementStatus = 'open' | 'paid' | 'past_due';
