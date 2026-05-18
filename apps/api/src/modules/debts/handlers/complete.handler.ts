import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { CompleteDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { completeDebt } from '../services/debt.service';

export const complete = async ({
  params,
  user,
  debtRepo = new DebtRepository(db)
}: CompleteDebtContext) => {
  const result = await completeDebt(params.id, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, 'Debt marked as paid');
};
