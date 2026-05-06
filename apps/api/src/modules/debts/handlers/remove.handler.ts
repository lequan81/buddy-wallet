import { BE_ERRORS } from '@repo/errors';
import { debtRepo } from './_deps';
import type { RemoveDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';

export const remove = async ({ params, user }: RemoveDebtContext) => {
  const debt = await debtRepo.findById(params.id);

  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
  }

  if (debt.creditorId !== user.id) {
    return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
  }

  if (debt.status !== 'cancelled') {
    return apiError(BE_ERRORS.DEBT_INVALID_STATE);
  }

  await debtRepo.softDelete(params.id, new Date());

  logActivity({
    userId: user.id,
    action: 'delete',
    resource: 'debt',
    resourceId: params.id
  });

  return apiSuccess({ deleted: true }, 'Debt deleted successfully');
};
