import { BE_ERRORS } from '@repo/errors';
import { SHARED_CONSTANTS } from '@repo/config';
import { validateDebtAmount, validateCurrency } from '../services/debt.service';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { UserRepository } from '@/repositories/user/user.repo';
import type { CreateDebtContext } from '../types/handler.types';
import { apiCreated, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';
import { onDebtCreated } from '@/modules/notification/services/notification-triggers.service';

const { MAX_PENDING_DEBTS } = SHARED_CONSTANTS.USER;
const { DUPLICATE_TOLERANCE: DUPLICATE_AMOUNT_TOLERANCE, DUPLICATE_CHECK_DAYS: DUPLICATE_DAYS_BACK } = SHARED_CONSTANTS.DEBT;

export const create = async ({
  body,
  user,
  debtRepo = new DebtRepository(db),
  userRepo = new UserRepository(db)
}: CreateDebtContext) => {
  const { debtorId, amount, currency, description, dueDate, debtorPhone, creditorPhone } = body;

  const amountValidation = validateDebtAmount(amount);
  if ('code' in amountValidation) {
    return apiError(BE_ERRORS.AMOUNT_INVALID, amountValidation.error ?? 'Invalid amount');
  }

  const currencyValidation = validateCurrency(currency);
  if ('code' in currencyValidation) {
    return apiError(BE_ERRORS.CURRENCY_INVALID, currencyValidation.error ?? 'Invalid currency');
  }

  const debtor = await userRepo.findById(debtorId);
  if (!debtor) {
    return apiError(BE_ERRORS.USER_NOT_FOUND);
  }

  if (debtorId === user.id) {
    return apiError(BE_ERRORS.DEBT_SELF_NOT_ALLOWED);
  }

  // Check pending debt limit (max 10 unconfirmed debts per user)
  const pendingCount = await debtRepo.countUnconfirmedByCreditor(user.id);
  if (pendingCount >= MAX_PENDING_DEBTS) {
    return apiError(BE_ERRORS.DEBT_PENDING_LIMIT);
  }

  // Check for duplicate debts (amount ±10% within last 30 days, same parties)
  const cpPhone = creditorPhone || user.phoneNumber;
  const dpPhone = debtorPhone || debtor.phoneNumber;
  const tolerance = amount * DUPLICATE_AMOUNT_TOLERANCE;
  const duplicates = await debtRepo.findPotentialDuplicates(
    dpPhone, cpPhone, amount, tolerance, DUPLICATE_DAYS_BACK
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

  return apiCreated({
    ...result,
    duplicateWarning: duplicates.length > 0 ? {
      count: duplicates.length,
      message: `Found ${duplicates.length} similar debt(s) in the last ${DUPLICATE_DAYS_BACK} days`
    } : undefined
  }, 'Debt created successfully');
};
