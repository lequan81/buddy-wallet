/**
 * Service orchestration to create a debt suggestion/request
 */

import { BE_ERRORS } from '@repo/errors';
import type { Debt } from '@repo/types';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import type { UserRepository } from '@/repositories/user/user.repo';
import { logActivity } from '@/commons/logging/activity-logger';
import type { AuthenticatedUser } from '@repo/types/api/handler-context';
import { onDebtCreated } from '@/modules/notification/services/notification-triggers.service';
import { SHARED_CONSTANTS } from '@repo/config';
import type { CreateDebtBody } from '../types/handler.types';
import { validateDebtAmount, validateCurrency } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function createDebt(
  body: CreateDebtBody,
  user: AuthenticatedUser,
  debtRepo: DebtRepository,
  userRepo: UserRepository
): Promise<ServiceResult<Debt & { duplicateWarning?: { count: number; message: string } }>> {
  const { debtorId, amount, currency, description, dueDate, debtorPhone, creditorPhone } = body;

  const amountValidation = validateDebtAmount(amount);
  if ('code' in amountValidation) {
    return { error: { ...BE_ERRORS.AMOUNT_INVALID, message: amountValidation.error ?? 'Invalid amount' } };
  }

  const currencyValidation = validateCurrency(currency);
  if ('code' in currencyValidation) {
    return { error: { ...BE_ERRORS.CURRENCY_INVALID, message: currencyValidation.error ?? 'Invalid currency' } };
  }

  const debtor = await userRepo.findById(debtorId);
  if (!debtor) {
    return { error: BE_ERRORS.USER_NOT_FOUND };
  }

  if (debtorId === user.id) {
    return { error: BE_ERRORS.DEBT_SELF_NOT_ALLOWED };
  }

  // Check pending debt limit (max pending debts per user)
  const pendingCount = await debtRepo.countUnconfirmedByCreditor(user.id);
  if (pendingCount >= SHARED_CONSTANTS.USER.MAX_PENDING_DEBTS) {
    return { error: BE_ERRORS.DEBT_PENDING_LIMIT };
  }

  // Check for duplicate debts
  const cpPhone = creditorPhone || user.phoneNumber;
  const dpPhone = debtorPhone || debtor.phoneNumber;
  const tolerance = amount * SHARED_CONSTANTS.DEBT.DUPLICATE_TOLERANCE;
  const duplicates = await debtRepo.findPotentialDuplicates(
    dpPhone, cpPhone, amount, tolerance, SHARED_CONSTANTS.DEBT.DUPLICATE_CHECK_DAYS
  );

  const result = await debtRepo.create({
    creditorPhone: cpPhone,
    debtorPhone: dpPhone,
    creditorId: user.id,
    debtorId,
    uploadedById: user.id,
    amount,
    currency: currency.toUpperCase(),
    description,
    expiresAt: dueDate ? new Date(dueDate) : null,
    status: 'pending'
  });

  logActivity({
    userId: user.id,
    action: 'create',
    resource: 'debt',
    resourceId: result.id,
    changes: { after: { amount, currency, description, debtorId } }
  });

  // Fire-and-forget: notify counterparty
  onDebtCreated(result, user.id).catch(() => {});

  return {
    data: {
      ...result,
      duplicateWarning: duplicates.length > 0 ? {
        count: duplicates.length,
        message: `Found ${duplicates.length} similar debt(s) in the last ${SHARED_CONSTANTS.DEBT.DUPLICATE_CHECK_DAYS} days`
      } : undefined
    }
  };
}

