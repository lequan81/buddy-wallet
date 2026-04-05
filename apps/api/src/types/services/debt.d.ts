/**
 * Debt Type Definitions
 * Re-exported from @repo/types
 */
import type { CurrentUser } from '@repo/types';

export type { DebtStatus, DebtDirection, CreateDebtInput, DebtResult, StatusUpdateResult } from '@repo/types';

/** Debt actor source for mapping from authenticated context */
export type DebtActorSource = Pick<CurrentUser, 'id' | 'phoneNumber' | 'role' | 'email'> & {
  permissions: string[];
};
