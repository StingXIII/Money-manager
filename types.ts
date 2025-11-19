
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Account {
  id: string;
  name: string; // Bank, Card, Wallet Group, or Wallet Name
  type: 'bank' | 'credit' | 'wallet_group' | 'wallet'; // Replaced 'cash'
  parentId: string | null; // Links credit cards to a bank account or wallets to a wallet group

  // --- Fields for type 'bank' ---
  balance?: number;
  limit?: number; // Total credit limit for all cards under this bank

  // --- Fields for type 'wallet' or 'wallet_group' ---
  // (balance is also used here)

  // --- Fields for type 'credit' ---
  currentDebt?: number; // Current outstanding debt on the card
  statementDate?: string; // e.g., '25' or 'EOM' for End of Month
  paymentDueDateOffset?: number; // e.g., 15 (days after statement date)
  annualFee?: number; // Annual fee as a percentage, e.g., 2.5 for 2.5%
  cashbackRate?: number; // Cashback rate as a percentage, e.g., 1.5 for 1.5%
  maxCashbackPerMonth?: number; // Max cashback (in cash value) that can be earned per month. Cashback is awarded as points.
  currentPoints?: number; // Current reward points
}


export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  parentId: string | null;
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'payment' | 'cashback';

// 'source' and 'destination' can be an internal account or an external entity
export interface TransactionEndpoint {
    id: string; // If it's an account, this is the account ID. If external, can be a descriptive slug like 'external'.
    name: string; // The name of the account or the external entity description.
}

export interface Transaction {
  id: string;
  reason: string;
  amount: number;
  transactionType: TransactionType;
  source: TransactionEndpoint;
  destination: TransactionEndpoint;
  date: Timestamp;
  // Fix: Add optional categoryId to link transactions to categories.
  categoryId?: string;
  planId?: string; // Links this transaction to a recurring Plan
}

export interface Plan {
  id: string;
  name: string; // The default reason (e.g., "Electricity Bill")
  amount: number; // Estimated amount
  type: 'expense' | 'income';
  categoryId: string;
}

export interface Loan {
    id: string;
    name: string;
    fromAccountId: string; // The bank/credit account the loan was taken from
    fromAccountName: string;
    totalAmount: number;
    interestRate: number; // Annual percentage
    termMonths: number;
    startDate: Timestamp;
    remainingBalance: number;
}

export interface PaymentSchedule {
    id: string; // payment number as string
    paymentDate: Timestamp;
    principal: number;
    interest: number;
    totalPayment: number;
    isPaid: boolean;
    interestRateSnapshot?: number; // The interest rate applied for this specific payment
    remainingBalance?: number; // The remaining balance of the loan AFTER this payment
}

export interface LoanWithSchedule extends Loan {
  schedule: PaymentSchedule[];
}