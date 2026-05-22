import { BE_ERRORS } from '@repo/errors';
import { getDebtDirection, isDebtOverdue } from '../services/debt.service';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { UserRepository } from '@/repositories/user/user.repo';
import type { GetDebtContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';

export const get = async ({
  params,
  user,
  debtRepo = new DebtRepository(db),
  userRepo = new UserRepository(db)
}: GetDebtContext) => {
  const debt = await debtRepo.findById(params.id);
  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
  }

  if (debt.creditorId !== user.id && debt.debtorId !== user.id) {
    return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
  }

  // N+1 prevention: batch-fetch user details for creditor/debtor
  const userIds = [debt.creditorId, debt.debtorId].filter(Boolean) as string[];
  const users = await userRepo.findByIds(userIds);
  const userMap = new Map(users.map(u => [u.id, { name: u.name, phoneNumber: u.phoneNumber }]));

  return apiSuccess({
    ...debt,
    direction: getDebtDirection(user.id, debt.creditorId || '', debt.debtorId || ''),
    overdue: isDebtOverdue(debt.expiresAt ? new Date(debt.expiresAt) : null, debt.status),
    creditorName: debt.creditorId ? userMap.get(debt.creditorId)?.name || null : (debt.customCreditorName || null),
    debtorName: debt.debtorId ? userMap.get(debt.debtorId)?.name || null : (debt.customDebtorName || null),
    customCreditorName: debt.customCreditorName || null,
    customDebtorName: debt.customDebtorName || null,
  });
};
