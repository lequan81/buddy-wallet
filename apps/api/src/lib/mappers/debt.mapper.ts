/**
 * Debt mapper - Transform domain models to API responses
 */

import type { Debt as DebtEntity } from '@repo/db';
import { maskPhoneNumber } from '@repo/utils';

export interface DebtResponse {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  direction: 'owed' | 'owing' | null;
  debtorId: string | null;
  debtorPhone: string | null;
  creditorId: string | null;
  creditorPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  needsConfirmation: boolean;
  confirmedByDebtor: boolean;
  confirmedByCreditor: boolean;
}

/**
 * Map database debt entity to API response
 */
export function toDebtResponse(debt: DebtEntity, currentUserId?: string): DebtResponse {
  let direction: 'owed' | 'owing' | null = null;
  if (currentUserId) {
    if (debt.creditorId === currentUserId) direction = 'owed';
    else if (debt.debtorId === currentUserId) direction = 'owing';
  }

  return {
    id: debt.id,
    amount: debt.amount,
    currency: debt.currency,
    description: debt.description,
    status: debt.status,
    direction,
    debtorId: debt.debtorId,
    debtorPhone: debt.debtorPhone ? maskPhoneNumber(debt.debtorPhone) : null,
    creditorId: debt.creditorId,
    creditorPhone: debt.creditorPhone ? maskPhoneNumber(debt.creditorPhone) : null,
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
    expiresAt: debt.expiresAt,
    needsConfirmation: debt.needsConfirmation,
    confirmedByDebtor: debt.confirmedByDebtor,
    confirmedByCreditor: debt.confirmedByCreditor
  };
}

/**
 * Map multiple debts to responses
 */
export function toDebtResponses(debts: DebtEntity[], currentUserId?: string): DebtResponse[] {
  return debts.map(debt => toDebtResponse(debt, currentUserId));
}
