/**
 * Confirm handler — Two-party debt confirmation.
 * @logicType http
 *
 * Uses a database transaction to prevent TOCTOU race conditions
 * between reading the debt state and writing the confirmation update.
 *
 * Validation is performed BEFORE the transaction for fast failure.
 * The transaction re-reads for TOCTOU safety and uses a sentinel
 * error for the race condition case.
 */

import { BE_ERRORS } from '@repo/errors';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { validateStatusTransition } from '../services/debt.service';
import type { ConfirmDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';
import { onDebtConfirmed } from '@/modules/notification/services/notification-triggers.service';

export const confirm = async ({ params, user }: ConfirmDebtContext) => {
  // Pre-transaction validation: fast failure before starting a transaction
  const debtRepo = new DebtRepository(db);
  const debt = await debtRepo.findById(params.id);
  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
  }

  const transition = validateStatusTransition(
    debt.status,
    'confirmed',
    user.id,
    debt.creditorId || '',
    debt.debtorId || ''
  );

  if ('code' in transition) {
    if (transition.code === BE_ERRORS.DEBT_PERMISSION_DENIED.code) {
      return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
    }
    return apiError(BE_ERRORS.DEBT_INVALID_STATUS);
  }

  // Transaction for atomicity: re-read for TOCTOU safety
  let updated;
  try {
    updated = await db.transaction(async (tx) => {
      const txDebtRepo = new DebtRepository(tx);

      const txDebt = await txDebtRepo.findById(params.id);
      if (!txDebt) {
        throw new Error('RACE_CONDITION_DEBT_GONE');
      }

      // Two-party confirmation: mark the confirming party's flag
      const isCreditor = user.id === txDebt.creditorId;
      const isDebtor = user.id === txDebt.debtorId;

      const updateData: Parameters<typeof debtRepo.update>[1] = {
        updatedAt: new Date(),
        confirmedByCreditor: isCreditor ? true : undefined,
        creditorConfirmedAt: isCreditor ? new Date() : undefined,
        confirmedByDebtor: isDebtor ? true : undefined,
        debtorConfirmedAt: isDebtor ? new Date() : undefined
      };

      // If both parties have confirmed, mark as fully confirmed
      const bothConfirmed =
        (isCreditor ? true : txDebt.confirmedByCreditor) &&
        (isDebtor ? true : txDebt.confirmedByDebtor);

      if (bothConfirmed) {
        updateData.status = 'confirmed';
      }

      const result = await txDebtRepo.update(params.id, updateData);
      if (!result) {
        throw new Error('RACE_CONDITION_DEBT_GONE');
      }

      return result;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'RACE_CONDITION_DEBT_GONE') {
      return apiError(BE_ERRORS.DEBT_NOT_FOUND);
    }
    throw err; // re-throw unexpected errors to global handler
  }

  logActivity({
    userId: user.id,
    action: 'confirm',
    resource: 'debt',
    resourceId: params.id,
    changes: { after: updated as unknown as Record<string, unknown> }
  });

  // Fire-and-forget: notify other party if fully confirmed
  if (updated.status === 'confirmed') {
    onDebtConfirmed(updated, user.id).catch(() => {});
  }

  return apiSuccess(updated, 'Debt confirmation updated');
};
