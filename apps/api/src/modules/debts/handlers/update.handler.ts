import { BE_ERRORS } from '@repo/errors';
import { validateDebtAmount, validateCurrency } from '../services/debt.service';
import { debtRepo } from './_deps';
import type { UpdateDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';

export const update = async ({ params, body, user }: UpdateDebtContext) => {
  const { amount, currency, description, dueDate } = body;
  const debt = await debtRepo.findById(params.id);

  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
  }

  if (debt.creditorId !== user.id) {
    return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
  }

  if (debt.status !== 'pending' && debt.status !== 'disputed') {
    return apiError(BE_ERRORS.DEBT_INVALID_STATUS);
  }

  if (amount !== undefined) {
    const amountValidation = validateDebtAmount(amount);
    if ('code' in amountValidation) {
      return apiError(BE_ERRORS.AMOUNT_INVALID, amountValidation.error ?? 'Invalid amount');
    }
  }

  if (currency !== undefined) {
    const currencyValidation = validateCurrency(currency);
    if ('code' in currencyValidation) {
      return apiError(BE_ERRORS.CURRENCY_INVALID, currencyValidation.error ?? 'Invalid currency');
    }
  }

  const updated = await debtRepo.update(params.id, {
    amount: amount ?? debt.amount,
    currency: currency ? currency.toUpperCase() : debt.currency,
    description: description ?? debt.description,
    expiresAt: dueDate ? new Date(dueDate) : debt.expiresAt,
    updatedAt: new Date()
  });

  logActivity({
    userId: user.id,
    action: 'update',
    resource: 'debt',
    resourceId: params.id,
    changes: { before: { amount: debt.amount, description: debt.description }, after: { amount: updated?.amount, description: updated?.description } }
  });

  return apiSuccess(updated, 'Debt updated successfully');
};
