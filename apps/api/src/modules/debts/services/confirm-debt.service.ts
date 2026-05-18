/**
 * Service orchestration to confirm two-party debt
 */

import { BE_ERRORS } from '@repo/errors';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/activity-logger';
import { onDebtConfirmed } from '@/modules/notification/services/notification-triggers.service';
import { validateStatusTransition } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function confirmDebt(
  debtId: string,
  user: any,
  txDb: any,
  debtRepo: DebtRepository
): Promise<ServiceResult<any>> {
  const debt = await debtRepo.findById(debtId);
  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
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
      return { error: BE_ERRORS.DEBT_PERMISSION_DENIED };
    }
    return { error: BE_ERRORS.DEBT_INVALID_STATUS };
  }

  let updated;
  try {
    updated = await txDb.transaction(async (tx: any) => {
      const txDebtRepo = new DebtRepository(tx);

      const txDebt = await txDebtRepo.findById(debtId);
      if (!txDebt) {
        throw new Error('RACE_CONDITION_DEBT_GONE');
      }

      // Two-party confirmation: mark the confirming party's flag
      const isCreditor = user.id === txDebt.creditorId;
      const isDebtor = user.id === txDebt.debtorId;

      const updateData: any = {
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

      const result = await txDebtRepo.update(debtId, updateData);
      if (!result) {
        throw new Error('RACE_CONDITION_DEBT_GONE');
      }

      return result;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'RACE_CONDITION_DEBT_GONE') {
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
