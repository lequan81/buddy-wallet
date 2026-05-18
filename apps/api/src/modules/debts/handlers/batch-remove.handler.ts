import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { apiSuccess, apiError } from '@/commons/http/response';
import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { DebtDeps } from '../types/handler.types';
import { batchRemoveDebts } from '../services/debt.service';

export type BatchRemoveDebtContext = AuthenticatedHandlerContext<{ ids: string[] }, never, never, DebtDeps>;

export const batchRemove = async ({
  body,
  user,
  debtRepo = new DebtRepository(db)
}: BatchRemoveDebtContext) => {
  const result = await batchRemoveDebts(body.ids, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, `Successfully deleted ${result.data.deleted.length} debts`);
};
