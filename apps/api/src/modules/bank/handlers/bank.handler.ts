/**
 * Bank Account Handlers
 * @logicType http
 */

import { db } from '@/providers/database';
import { BankAccountRepository } from '@/repositories/bank/bank-account.repo';
import { BE_ERRORS } from '@repo/errors';
import { calculatePagination } from '@/commons/pagination';
import { validateBankAccountData, maskAccountNumber } from '../services/bank.service';
import { apiSuccess, apiError, apiCreated } from '@/commons/http/response';
import type {
  CreateBankAccountContext,
  GetBankAccountContext,
  ListBankAccountsContext,
  RemoveBankAccountContext,
  SetDefaultBankAccountContext,
  UpdateBankAccountContext
} from '../types/handler.types';

const bankAccountRepo = new BankAccountRepository(db);

export const bank = {
  /** POST /bank/accounts */
  create: async ({ body, user }: CreateBankAccountContext) => {
    const { bankName, accountNumber, accountName, isDefault } = body;

    const validation = validateBankAccountData({ bankName, accountNumber, accountName });
    if ('code' in validation) {
      return apiError(BE_ERRORS.INVALID_INPUT, validation.error);
    }

    if (isDefault) await bankAccountRepo.unsetDefaultAccounts(user.id);

    const bankAccount = await bankAccountRepo.create({
      userId: user.id,
      bankCode: body.bankCode ?? '',
      bankBin: body.bankBin ?? '',
      bankName,
      accountNumber,
      accountName: accountName ?? null,
      isDefault: isDefault || false
    });

    return apiCreated({ ...bankAccount, accountNumber: maskAccountNumber(bankAccount.accountNumber) }, 'Bank account created');
  },

  /** GET /bank/accounts/:id */
  get: async ({ params, user }: GetBankAccountContext) => {
    const bankAccount = await bankAccountRepo.findById(params.id);
    if (!bankAccount) {
      return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
    }
    if (bankAccount.userId !== user.id) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    return apiSuccess({ ...bankAccount, accountNumber: maskAccountNumber(bankAccount.accountNumber) });
  },

  /** GET /bank/accounts */
  list: async ({ query, user }: ListBankAccountsContext) => {
    const { page = 1, limit = 20 } = query;
    const result = await bankAccountRepo.findByUserId(user.id, limit, (page - 1) * limit);

    const maskedAccounts = result.data.map((account) => ({
      ...account,
      accountNumber: maskAccountNumber(account.accountNumber)
    }));

    return apiSuccess(maskedAccounts, undefined, calculatePagination(result.total, page, limit) as unknown as Record<string, unknown>);
  },

  /** PATCH /bank/accounts/:id */
  update: async ({ params, body, user }: UpdateBankAccountContext) => {
    const { bankName, accountNumber, accountName, isDefault } = body;
    const bankAccount = await bankAccountRepo.findById(params.id);
    if (!bankAccount) {
      return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
    }
    if (bankAccount.userId !== user.id) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    const validation = validateBankAccountData({ bankName, accountNumber, accountName });
    if ('code' in validation) {
      return apiError(BE_ERRORS.INVALID_INPUT, validation.error);
    }

    if (isDefault && !bankAccount.isDefault) await bankAccountRepo.unsetDefaultAccounts(user.id);

    const updatedAccount = await bankAccountRepo.update(params.id, {
      bankName: bankName ?? bankAccount.bankName,
      accountNumber: accountNumber ?? bankAccount.accountNumber,
      accountName: accountName ?? bankAccount.accountName,
      isDefault: isDefault ?? bankAccount.isDefault
    });
    if (!updatedAccount) {
      return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
    }

    return apiSuccess({ ...updatedAccount, accountNumber: maskAccountNumber(updatedAccount.accountNumber) }, 'Bank account updated');
  },

  /** DELETE /bank/accounts/:id */
  remove: async ({ params, user }: RemoveBankAccountContext) => {
    const bankAccount = await bankAccountRepo.findById(params.id);
    if (!bankAccount) {
      return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
    }
    if (bankAccount.userId !== user.id) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    if (bankAccount.isDefault) {
      const totalAccounts = await bankAccountRepo.countByUserId(user.id);
      if (totalAccounts <= 1) {
        return apiError(BE_ERRORS.INVALID_STATE);
      }
    }

    await bankAccountRepo.delete(params.id);
    return apiSuccess({ deleted: true }, 'Bank account deleted');
  },

  /** POST /bank/accounts/:id/set-default */
  setDefault: async ({ params, user }: SetDefaultBankAccountContext) => {
    const bankAccount = await bankAccountRepo.findById(params.id);
    if (!bankAccount) {
      return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
    }
    if (user.id !== bankAccount.userId) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    await bankAccountRepo.setPrimary(params.id, user.id);
    return apiSuccess({ isDefault: true }, 'Default bank account set');
  }
};
