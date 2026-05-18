import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { DebtDeps } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { removeAllDebts } from '../services/debt.service';

export type RemoveAllDebtContext = AuthenticatedHandlerContext<never, never, { confirm: 'true' }, DebtDeps>;

export const removeAll = async ({
  query,
  user,
  debtRepo = new DebtRepository(db)
}: RemoveAllDebtContext) => {
  const result = await removeAllDebts(query.confirm, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, `Successfully deleted ${result.data.deleted} debts`);
};
