import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { apiSuccess, apiError } from '@/commons/http/response';
import type { SuggestEditContext } from '../types/handler.types';
import { suggestEdit } from '../services/debt.service';

export const suggest = async ({
  params,
  body,
  user,
  debtRepo = new DebtRepository(db)
}: SuggestEditContext) => {
  const result = await suggestEdit(params.id, body, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiSuccess(result.data, 'Edit suggestion submitted');
};
