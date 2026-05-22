/**
 * Service orchestration to mark a debt as paid (completed)
 */

import { BE_ERRORS } from '@repo/errors';
import type { Debt } from '@repo/db';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/logging/activity-logger';
import type { AuthenticatedUser } from '@repo/types/api/handler-context';
import { onDebtPaid } from '@/modules/notification/services/notification-triggers.service';
import { validateStatusTransition } from './validation.service';
import type { ServiceResult } from './debt.service';

export async function completeDebt(
  debtId: string,
  user: AuthenticatedUser,
  debtRepo: DebtRepository
): Promise<ServiceResult<Debt | null>> {
  const debt = await debtRepo.findById(debtId);
  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  const transition = validateStatusTransition({
    currentStatus: debt.status,
    newStatus: 'paid',
    userId: user.id,
    creditorId: debt.creditorId || '',
    debtorId: debt.debtorId || ''
  });

  if ('code' in transition) {
    return { error: transition };
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

