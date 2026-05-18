import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { ConfirmDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';
import { confirmDebt } from '../services/debt.service';

export const confirm = async ({ params, user }: ConfirmDebtContext) => {
  const debtRepo = new DebtRepository(db);
  const result = await confirmDebt(params.id, user, db, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, 'Debt confirmation updated');
};
