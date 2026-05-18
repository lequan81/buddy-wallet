import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { DebtDeps } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';

export type RemoveAllDebtContext = AuthenticatedHandlerContext<never, never, { confirm: 'true' }, DebtDeps>;
const REMOVE_ALL_FETCH_LIMIT = 1000;

export const removeAll = async ({
  query,
  user,
  debtRepo = new DebtRepository(db)
}: RemoveAllDebtContext) => {
  if (query.confirm !== 'true') {
    return apiError({ code: 'BAD_REQUEST', message: 'Must confirm deletion', status: 400 });
  }

  // Find all cancelled debts where the user is the creditor
  const { items: debts } = await debtRepo.findMany({
    creditorId: user.id,
    status: 'cancelled',
    limit: REMOVE_ALL_FETCH_LIMIT
  });

  if (debts.length === 0) {
    return apiSuccess({ deleted: 0 }, 'No eligible debts found to delete');
  }

  const ids = debts.map((d) => d.id);
  const { deleted } = await debtRepo.batchSoftDelete(ids, new Date());

  // Log activity
  logActivity({
    userId: user.id,
    action: 'delete_all',
    resource: 'debt',
    resourceId: 'all_cancelled'
  });

  return apiSuccess({ deleted: deleted.length }, `Successfully deleted ${deleted.length} debts`);
};
