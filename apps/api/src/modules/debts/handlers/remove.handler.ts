import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { RemoveDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { removeDebt } from '../services/debt.service';

export const remove = async ({
  params,
  user,
  debtRepo = new DebtRepository(db)
}: RemoveDebtContext) => {
  const result = await removeDebt(params.id, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, 'Debt deleted successfully');
};
