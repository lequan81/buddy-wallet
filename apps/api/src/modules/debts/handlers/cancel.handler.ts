import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { CancelDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { cancelDebt } from '../services/debt.service';

export const cancel = async ({
  params,
  user,
  debtRepo = new DebtRepository(db)
}: CancelDebtContext) => {
  const result = await cancelDebt(params.id, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, 'Debt cancelled successfully');
};
