/**
 * Service orchestration to mark a debt as paid (completed)
 */

import { BE_ERRORS } from '@repo/errors';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/activity-logger';
import { onDebtPaid } from '@/modules/notification/services/notification-triggers.service';
import { validateStatusTransition } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function completeDebt(
  debtId: string,
  user: any,
  debtRepo: DebtRepository
): Promise<ServiceResult<any>> {
  const debt = await debtRepo.findById(debtId);
  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  const transition = validateStatusTransition(
    debt.status,
    'paid',
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

  const updated = await debtRepo.update(debtId, {
    status: 'paid',
    updatedAt: new Date()
  });

  logActivity({
    userId: user.id,
    action: 'status_change',
    resource: 'debt',
    resourceId: debtId,
    changes: { before: { status: debt.status }, after: { status: 'paid' } }
  });

  // Fire-and-forget: notify creditor
  onDebtPaid(debt, user.id).catch(() => {});

  return { data: updated };
}
