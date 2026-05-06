/**
 * Bank Service - Pure Functions
 * @logicType backend
 */

import type { Result } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';

/**
 * Validate bank account data
 */
export function validateBankAccountData(data: {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}): Result<void> {
  if (data.bankName !== undefined) {
    if (data.bankName.length < 2 || data.bankName.length > 100) {
      return { code: BE_ERRORS.BANK_NAME_INVALID.code, error: 'Bank name must be between 2 and 100 characters' };
    }
  }
  if (data.accountNumber !== undefined) {
    if (data.accountNumber.length < 8 || data.accountNumber.length > 20) {
      return { code: BE_ERRORS.ACCOUNT_NUMBER_INVALID.code, error: 'Account number must be between 8 and 20 characters' };
    }
  }
  if (data.accountName !== undefined) {
    if (data.accountName.length < 2 || data.accountName.length > 100) {
      return { code: BE_ERRORS.ACCOUNT_NAME_INVALID.code, error: 'Account name must be between 2 and 100 characters' };
    }
  }
  return { data: undefined };
}

/**
 * Mask account number for display
 */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return '****' + accountNumber.slice(-4);
}
