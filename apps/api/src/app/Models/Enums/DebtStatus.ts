/**
 * Debt Status Enum
 *
 * Defines all possible states for a debt in the system.
 */

export type DebtStatus = 'pending' | 'confirmed' | 'disputed' | 'paid' | 'cancelled';

export const DEBT_STATUSES: Record<DebtStatus, DebtStatus> = {
  pending: 'pending',
  confirmed: 'confirmed',
  disputed: 'disputed',
  paid: 'paid',
  cancelled: 'cancelled'
};

/**
 * Check if a string is a valid debt status
 */
export function isValidDebtStatus(value: unknown): value is DebtStatus {
  return (
    typeof value === 'string' &&
    Object.values(DEBT_STATUSES).includes(value as DebtStatus)
  );
}
