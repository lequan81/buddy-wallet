/**
 * Bank Account Mapper - Domain Transformations
 *
 * Handles transformation between Database BankAccount entities and domain objects.
 */
import type { BankAccount as BankAccountEntity } from '@repo/db';

/**
 * Safe bank account info (excludes sensitive fields)
 */
export interface BankAccountInfo {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string; // Masked
  accountName: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mask account number for security (show last 4 digits only)
 */
function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return '****';
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

/**
 * Map database bank account entity to safe domain object
 */
export function toBankAccountInfo(entity: BankAccountEntity): BankAccountInfo {
  return {
    id: entity.id,
    userId: entity.userId,
    bankCode: entity.bankCode,
    bankName: entity.bankName,
    accountNumber: maskAccountNumber(entity.accountNumber),
    accountName: entity.accountName,
    isDefault: entity.isDefault,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString()
  };
}

/**
 * Map multiple bank accounts to safe domain objects
 */
export function toBankAccountInfoList(entities: BankAccountEntity[]): BankAccountInfo[] {
  return entities.map(toBankAccountInfo);
}

/**
 * Map to admin view (full account number)
 * Only for authorized admin use
 */
export function toBankAccountAdminView(entity: BankAccountEntity): Omit<BankAccountInfo, 'accountNumber'> & { accountNumber: string } {
  return {
    id: entity.id,
    userId: entity.userId,
    bankCode: entity.bankCode,
    bankName: entity.bankName,
    accountNumber: entity.accountNumber, // Full number for admin
    accountName: entity.accountName,
    isDefault: entity.isDefault,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString()
  };
}
