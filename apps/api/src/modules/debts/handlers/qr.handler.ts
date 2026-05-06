/**
 * QR Code Generation Handler — VietQR URL Construction
 * @logicType http
 *
 * Uses VietQR as single source of truth for QR generation.
 * Constructs embeddable image URLs — no backend image processing needed.
 */

import { db } from '@/providers/database';
import { BankAccountRepository } from '@/repositories/bank/bank-account.repo';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { BE_ERRORS } from '@repo/errors';
import { apiSuccess, apiError } from '@/commons/http/response';
import type { GenerateQRContext } from '../types/handler.types';

const bankAccountRepo = new BankAccountRepository(db);
const debtRepo = new DebtRepository(db);

const VIETQR_BASE = 'https://img.vietqr.io/image';

export const qr = {
  /** GET /debts/:id/qr — Generate VietQR payment URL for a debt */
  generate: async ({ params, user }: GenerateQRContext) => {
    const debt = await debtRepo.findById(params.id);
    if (!debt) {
      return apiError(BE_ERRORS.DEBT_NOT_FOUND);
    }

    // Only involved parties can generate QR
    if (debt.creditorId !== user.id && debt.debtorId !== user.id) {
      return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
    }

    // Get creditor's default bank account
    const creditorId = debt.creditorId;
    if (!creditorId) {
      return apiError(BE_ERRORS.INVALID_STATE, 'Debt has no creditor assigned');
    }

    const accounts = await bankAccountRepo.findByUserId(creditorId, 10, 0);
    const defaultAccount = accounts.data.find(a => a.isDefault) || accounts.data[0];

    if (!defaultAccount) {
      return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND, 'Creditor has no bank account');
    }

    // Construct VietQR image URL
    const bankBin = defaultAccount.bankBin || defaultAccount.bankCode;
    const accountNumber = defaultAccount.accountNumber;
    const amount = debt.amount;
    const addInfo = `Thanh toan no ${debt.id}`;

    const qrUrl = `${VIETQR_BASE}/${bankBin}-${accountNumber}-qr_only.jpg?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}`;

    return apiSuccess({
      qrUrl,
      bankName: defaultAccount.bankName,
      accountNumber: defaultAccount.accountNumber,
      accountName: defaultAccount.accountName,
      amount: debt.amount,
      currency: debt.currency,
      debtId: debt.id
    });
  }
};
