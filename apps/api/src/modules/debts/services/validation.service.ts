/**
 * Pure validation and utility services for Debts
 */

import type { Result } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';

/**
 * Validate debt amount
 */
export function validateDebtAmount(amount: number): Result<void> {
  if (amount <= 0) return { code: BE_ERRORS.AMOUNT_INVALID.code };
  if (amount > 999999999999) return { code: BE_ERRORS.AMOUNT_INVALID.code };
  return { data: undefined };
}

/**
 * Validate currency code
 */
export function validateCurrency(currency: string): Result<void> {
  const validCurrencies = ['USD', 'VND', 'EUR', 'GBP', 'JPY', 'CNY'];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    return { code: BE_ERRORS.CURRENCY_INVALID.code };
  }
  return { data: undefined };
}

/**
 * Validate debt status transition
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string,
  userId: string,
  creditorId: string,
  debtorId: string
): Result<void> {
  const validTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['paid', 'cancelled'],
    cancelled: [],
    paid: []
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return { code: BE_ERRORS.STATUS_TRANSITION_INVALID.code };
  }

  // Permission matrix: status → allowed role check
  const statusPermissions: Record<string, (uid: string, cid: string, did: string) => boolean> = {
    cancelled: (uid, cid) => uid === cid,
    confirmed: (uid, _cid, did) => uid === did,
    paid: (uid, _cid, did) => uid === did
  };

  const checkPermission = statusPermissions[newStatus];
  if (checkPermission && !checkPermission(userId, creditorId, debtorId)) {
    return { code: BE_ERRORS.DEBT_PERMISSION_DENIED.code };
  }

  return { data: undefined };
}

/**
 * Direction lookup map for debt relationship
 */
const directionMap: Record<string, (uid: string, id: string) => boolean> = {
  LEND: (uid, cid) => uid === cid,
  BORROW: (uid, did) => uid === did
};

/**
 * Calculate debt direction for user
 */
export function getDebtDirection(userId: string, creditorId: string, debtorId: string): 'LEND' | 'BORROW' | null {
  if (directionMap.LEND(userId, creditorId)) return 'LEND';
  if (directionMap.BORROW(userId, debtorId)) return 'BORROW';
  return null;
}

/**
 * Check if debt is overdue
 */
export function isDebtOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate || status !== 'pending') return false;
  return new Date() > dueDate;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
