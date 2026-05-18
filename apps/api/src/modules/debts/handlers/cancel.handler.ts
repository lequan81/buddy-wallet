import { BE_ERRORS } from '@repo/errors';
import { validateStatusTransition } from '../services/debt.service';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { CancelDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';

export const cancel = async ({
  params,
  user,
  debtRepo = new DebtRepository(db)
}: CancelDebtContext) => {
  const debt = await debtRepo.findById(params.id);
  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
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
      return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
    }
    return apiError(BE_ERRORS.DEBT_INVALID_STATUS);
  }

  const updated = await debtRepo.update(params.id, {
    status: 'cancelled',
    updatedAt: new Date()
  });

  logActivity({
    userId: user.id,
    action: 'status_change',
    resource: 'debt',
    resourceId: params.id,
    changes: { before: { status: debt.status }, after: { status: 'cancelled' } }
  });

  return apiSuccess(updated, 'Debt cancelled successfully');
};
