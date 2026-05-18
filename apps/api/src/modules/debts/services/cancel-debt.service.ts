/**
 * Service orchestration to cancel a pending/confirmed debt
 */

import { BE_ERRORS } from '@repo/errors';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/activity-logger';
import { validateStatusTransition } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function cancelDebt(
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
    'cancelled',
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
    status: 'cancelled',
    updatedAt: new Date()
  });

  logActivity({
    userId: user.id,
    action: 'status_change',
    resource: 'debt',
    resourceId: debtId,
    changes: { before: { status: debt.status }, after: { status: 'cancelled' } }
  });

  return { data: updated };
}
