/**
 * Debt Status Constants
 */
export const DEBT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
} as const;

export type DebtStatus = typeof DEBT_STATUS[keyof typeof DEBT_STATUS];
