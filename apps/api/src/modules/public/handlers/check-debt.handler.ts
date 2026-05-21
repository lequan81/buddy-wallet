/**
 * Public Check-Debt Handler
 * @logicType http
 *
 * Public endpoint to check if a phone number has active debts.
 * No authentication required. Strict rate limiting applied.
 */

import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { normalizePhoneNumber } from '@repo/utils';
import { BE_ERRORS } from '@repo/errors';
import { apiSuccess, apiError } from '@/commons/http/response';

const debtRepo = new DebtRepository(db);

/**
 * Mask phone number for privacy: 0123***678
 */
function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-3);
}

export const checkDebt = {
  /** GET /check-debt?phone=xxx — Public debt check */
  handler: async ({ query }: { query: { phone: string } }) => {
    const { phone } = query;

    if (!phone) {
      return apiError(BE_ERRORS.AUTH_INVALID_PHONE, 'Phone number is required');
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return apiError(BE_ERRORS.AUTH_INVALID_PHONE);
    }

    const count = await debtRepo.countActiveDebtsForPhone(normalizedPhone);

    return apiSuccess({
      hasDebts: count > 0,
      phone: maskPhone(normalizedPhone)
    });
  }
};
