/**
 * Service orchestration to confirm two-party debt
 */

import { BE_ERRORS } from '@repo/errors';
import type { Debt } from '@repo/types';
// eslint-disable-next-line no-restricted-imports
import { db, type DbClient } from '@repo/db';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/logging/activity-logger';
import type { AuthenticatedUser } from '@repo/types/api/handler-context';
import { onDebtConfirmed } from '@/modules/notification/services/notification-triggers.service';
import { validateStatusTransition } from './validation.service';
import type { ServiceResult } from './debt.service';
import { RaceConditionException } from '@/commons/errors/exceptions';

interface ConfirmationUpdateInput {
  userId: string;
  creditorId: string | null;
  debtorId: string | null;
  confirmedByCreditor: boolean;
  confirmedByDebtor: boolean;
}

export function computeConfirmationUpdate(input: ConfirmationUpdateInput) {
  const isCreditor = input.userId === input.creditorId;
  const isDebtor = input.userId === input.debtorId;

  const updateData = {
    updatedAt: new Date(),
    confirmedByCreditor: isCreditor ? true : undefined,
    creditorConfirmedAt: isCreditor ? new Date() : undefined,
    confirmedByDebtor: isDebtor ? true : undefined,
    debtorConfirmedAt: isDebtor ? new Date() : undefined,
    status: undefined as 'confirmed' | undefined
  };

  const bothConfirmed =
    (isCreditor ? true : input.confirmedByCreditor) &&
    (isDebtor ? true : input.confirmedByDebtor);

  if (bothConfirmed) {
    updateData.status = 'confirmed';
  }

  return updateData;
}

export async function confirmDebt(
  debtId: string,
  user: AuthenticatedUser,
  txDb: DbClient,
  debtRepo: DebtRepository
): Promise<ServiceResult<Debt>> {
  const debt = await debtRepo.findById(debtId);
  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  const transition = validateStatusTransition({
    currentStatus: debt.status,
    newStatus: 'confirmed',
    userId: user.id,
    creditorId: debt.creditorId || '',
    debtorId: debt.debtorId || ''
  });

  if ('code' in transition) {
    return { error: transition };
  }

  let updated: Debt;
  try {
    updated = await (txDb as typeof db).transaction(async (tx) => {
      const txDebtRepo = new DebtRepository(tx);

      const txDebt = await txDebtRepo.findById(debtId);
      if (!txDebt) {
        throw new RaceConditionException();
      }

      const updateData = computeConfirmationUpdate({
        userId: user.id,
        creditorId: txDebt.creditorId,
        debtorId: txDebt.debtorId,
        confirmedByCreditor: txDebt.confirmedByCreditor,
        confirmedByDebtor: txDebt.confirmedByDebtor
      });

      const result = await txDebtRepo.update(debtId, updateData);
      if (!result) {
        throw new RaceConditionException();
      }

      return result;
    });
  } catch (err) {
    if (err instanceof RaceConditionException) {
      return { error: BE_ERRORS.DEBT_NOT_FOUND };
    }
    throw err;
  }

  logActivity({
    userId: user.id,
    action: 'confirm',
    resource: 'debt',
    resourceId: debtId,
    changes: { after: updated as unknown as Record<string, unknown> }
  });

  if (updated.status === 'confirmed') {
    onDebtConfirmed(updated, user.id).catch(() => {});
  }

  return { data: updated };
}

