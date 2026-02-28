/**
 * Debt Type Definitions
 */
export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';
export type DebtDirection = 'LEND' | 'BORROW';

import type { DebtDirection, CreateDebtInput, DebtResult } from '@repo/types';

export type { DebtStatus, DebtDirection, CreateDebtInput, DebtResult } from '@repo/types';
