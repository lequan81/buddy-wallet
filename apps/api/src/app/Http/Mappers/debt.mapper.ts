/**
 * Debt Response Mapper
 *
 * Transforms Debt domain objects to API responses.
 */

import type { DebtRow } from '@repo/db';
import { Debt } from '@/app/Models/Debt';

export interface DebtResponse {
  id: string;
  amount: number;
  currency: string;
  debtorId: string;
  creditorId: string;
  status: string;
  direction: 'owed' | 'owing';
  isOverdue: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map Debt domain model to API response
 */
export function toDebtResponse(debt: Debt, userId: string): DebtResponse {
  const direction = debt.getDirectionForUser(userId);

  return {
    id: debt.id,
    amount: debt.amount,
    currency: debt.currency,
    debtorId: debt.debtorId,
    creditorId: debt.creditorId,
    status: debt.status,
    direction: direction || 'owing',
    isOverdue: debt.isOverdue(),
    description: debt.description,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString()
  };
}

/**
 * Map multiple debts to API responses
 */
export function toDebtListResponse(debts: Debt[], userId: string): DebtResponse[] {
  return debts.map((debt) => toDebtResponse(debt, userId));
}

/**
 * Map database row to Debt domain model
 */
export function rowToDebt(row: DebtRow): Debt {
  return new Debt(
    row.id,
    row.amount,
    row.currency,
    row.debtorId,
    row.creditorId,
    row.status as any,
    new Date(row.createdAt),
    new Date(row.updatedAt),
    row.description
  );
}
