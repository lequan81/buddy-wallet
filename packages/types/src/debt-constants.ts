export const DEBT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
} as const;

export const DEBT_DIRECTION = {
  LEND: 'LEND',
  BORROW: 'BORROW',
} as const;
