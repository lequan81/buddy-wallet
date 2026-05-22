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
  const { debtorId, amount, currency, description, dueDate, debtorPhone, creditorPhone, customDebtorName, customCreditorName } = body;

  const amountValidation = validateDebtAmount(amount);
  if ('code' in amountValidation) {
    return { error: { ...BE_ERRORS.AMOUNT_INVALID, message: amountValidation.error ?? 'Invalid amount' } };
  }

  const currencyValidation = validateCurrency(currency);
  if ('code' in currencyValidation) {
    return { error: { ...BE_ERRORS.CURRENCY_INVALID, message: currencyValidation.error ?? 'Invalid currency' } };
  }

  const cpPhone = creditorPhone || user.phoneNumber;
  const dpPhone = debtorPhone;
  if (!dpPhone) {
    return { error: { ...BE_ERRORS.AUTH_INVALID_PHONE, message: 'Debtor phone number is required' } };
  }

  if (dpPhone === cpPhone) {
    return { error: BE_ERRORS.DEBT_SELF_NOT_ALLOWED };
  }

  // Check pending debt limit (max pending debts per user)
  const pendingCount = await debtRepo.countUnconfirmedByCreditor(user.id);
  if (pendingCount >= SHARED_CONSTANTS.USER.MAX_PENDING_DEBTS) {
    return { error: BE_ERRORS.DEBT_PENDING_LIMIT };
  }

  // Check for duplicate debts
  const tolerance = amount * SHARED_CONSTANTS.DEBT.DUPLICATE_TOLERANCE;
  const duplicates = await debtRepo.findPotentialDuplicates(
    dpPhone, cpPhone, amount, tolerance, SHARED_CONSTANTS.DEBT.DUPLICATE_CHECK_DAYS
  );

  // Look up registered users dynamically
  const registeredDebtor = await userRepo.findByPhone(dpPhone);
  const registeredCreditor = await userRepo.findByPhone(cpPhone);

  const resolvedDebtorId = registeredDebtor ? registeredDebtor.id : (dpPhone === user.phoneNumber ? user.id : null);
  const resolvedCreditorId = registeredCreditor ? registeredCreditor.id : (cpPhone === user.phoneNumber ? user.id : null);

  const finalDebtorName = customDebtorName || (dpPhone === user.phoneNumber ? user.name : (registeredDebtor ? registeredDebtor.name : 'Unregistered User'));
  const finalCreditorName = customCreditorName || (cpPhone === user.phoneNumber ? user.name : (registeredCreditor ? registeredCreditor.name : 'Unregistered User'));

  const result = await debtRepo.create({
    creditorPhone: cpPhone,
    debtorPhone: dpPhone,
    creditorId: resolvedCreditorId,
    debtorId: resolvedDebtorId,
    customDebtorName: finalDebtorName,
    customCreditorName: finalCreditorName,
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
    changes: { after: { amount, currency, description, debtorId: resolvedDebtorId } }
  });

  // Fire-and-forget: notify counterparty if registered
  if (resolvedDebtorId && resolvedCreditorId) {
    onDebtCreated(result, user.id).catch(() => {});
  }

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

