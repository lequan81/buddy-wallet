import { BE_ERRORS } from '@repo/errors';
import { SHARED_CONSTANTS } from '@repo/config';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { DebtDeps } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';

export type BatchRemoveDebtContext = AuthenticatedHandlerContext<{ ids: string[] }, never, never, DebtDeps>;

export const batchRemove = async ({
  body,
  user,
  debtRepo = new DebtRepository(db)
}: BatchRemoveDebtContext) => {
  const { ids } = body;
  
  // Validate maximum batch size
  if (ids.length > SHARED_CONSTANTS.DEBT.MAX_BATCH_DELETE) {
    return apiError({
      code: 'BAD_REQUEST',
      message: `Cannot delete more than ${SHARED_CONSTANTS.DEBT.MAX_BATCH_DELETE} debts at once`,
      status: 400
    });
  }

  // Fetch debts to verify ownership and status
  const debts = await debtRepo.findByIds(ids);
  
  if (debts.length === 0) {
    return apiSuccess({ deleted: [], notFound: ids }, 'No debts found to delete');
  }

  // Filter debts that belong to the user as a creditor and are cancelled
  const eligibleIds = debts
    .filter(d => d.creditorId === user.id && d.status === 'cancelled')
    .map(d => d.id);

  if (eligibleIds.length === 0) {
    return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
  }

  const { deleted, notFound } = await debtRepo.batchSoftDelete(eligibleIds, new Date());

  // Log activity for each deleted debt
  for (const id of deleted) {
    logActivity({
      userId: user.id,
      action: 'delete',
      resource: 'debt',
      resourceId: id
    });
  }

  // If some were not eligible but existed, add them to notFound
  const actuallyNotFound = [...notFound, ...ids.filter(id => !eligibleIds.includes(id) && !notFound.includes(id))];

  return apiSuccess({ deleted, notFound: actuallyNotFound }, `Successfully deleted ${deleted.length} debts`);
};
