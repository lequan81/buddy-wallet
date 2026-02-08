/**
 * Debt Type Definitions
 */
export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';
export type DebtDirection = 'LEND' | 'BORROW';

import type { DebtDirection, CreateDebtInput, DebtResult } from '@repo/interfaces';

export type { DebtStatus, DebtDirection, CreateDebtInput, DebtResult } from '@repo/interfaces';

export interface StatusUpdateResult {
  success: boolean;
  error?: string;
  code?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debt?: any;
  previousStatus?: string;
  newStatus?: string;
  validTransitions?: string[];
}
