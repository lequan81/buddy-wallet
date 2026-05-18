import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { UserRepository } from '@/repositories/user/user.repo';
import type { CreateDebtContext } from '../types/handler.types';
import { apiCreated, apiError } from '@/commons/http/response';
import { createDebt } from '../services/debt.service';

export const create = async ({
  body,
  user,
  debtRepo = new DebtRepository(db),
  userRepo = new UserRepository(db)
}: CreateDebtContext) => {
  const result = await createDebt(body, user, debtRepo, userRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  return apiCreated(result.data, 'Debt created successfully');
};
