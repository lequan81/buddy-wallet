/**
 * Service orchestration to cancel a pending/confirmed debt
 */

import { BE_ERRORS } from '@repo/errors';
import type { Debt } from '@repo/db';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/logging/activity-logger';
import type { AuthenticatedUser } from '@repo/types/api/handler-context';
import { validateStatusTransition } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function cancelDebt(
  debtId: string,
  user: AuthenticatedUser,
  debtRepo: DebtRepository
): Promise<ServiceResult<Debt | null>> {
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

