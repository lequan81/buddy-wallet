/**
 * Debt Direction Constants
 */
export const DEBT_DIRECTION = {
  LEND: 'LEND',
  BORROW: 'BORROW',
} as const;

export type DebtDirection = typeof DEBT_DIRECTION[keyof typeof DEBT_DIRECTION];
