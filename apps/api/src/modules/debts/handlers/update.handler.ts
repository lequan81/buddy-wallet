import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { UpdateDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { updateDebt } from '../services/debt.service';

export const update = async ({
  params,
  body,
  user,
  debtRepo = new DebtRepository(db)
}: UpdateDebtContext) => {
  const result = await updateDebt(params.id, body, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, 'Debt updated successfully');
};
