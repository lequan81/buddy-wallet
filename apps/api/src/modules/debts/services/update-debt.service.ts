/**
 * Service orchestration to update a debt's core details
 */

import { BE_ERRORS } from '@repo/errors';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/activity-logger';
import type { UpdateDebtBody } from '../types/handler.types';
import { validateDebtAmount, validateCurrency } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function updateDebt(
  debtId: string,
  body: UpdateDebtBody,
  user: any,
  debtRepo: DebtRepository
): Promise<ServiceResult<any>> {
  const { amount, currency, description, dueDate } = body;
  const debt = await debtRepo.findById(debtId);

  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  if (debt.creditorId !== user.id) {
    return { error: BE_ERRORS.DEBT_PERMISSION_DENIED };
  }

  if (debt.status !== 'pending' && debt.status !== 'disputed') {
    return { error: BE_ERRORS.DEBT_INVALID_STATUS };
  }

  if (amount !== undefined) {
    const amountValidation = validateDebtAmount(amount);
    if ('code' in amountValidation) {
      return { error: { ...BE_ERRORS.AMOUNT_INVALID, message: amountValidation.error ?? 'Invalid amount' } };
    }
  }

  if (currency !== undefined) {
    const currencyValidation = validateCurrency(currency);
    if ('code' in currencyValidation) {
      return { error: { ...BE_ERRORS.CURRENCY_INVALID, message: currencyValidation.error ?? 'Invalid currency' } };
    }
  }

  const updated = await debtRepo.update(debtId, {
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
    resourceId: debtId,
    changes: {
      before: { amount: debt.amount, description: debt.description },
      after: { amount: updated?.amount, description: updated?.description }
    }
  });

  return { data: updated };
}
