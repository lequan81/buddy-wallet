import { calculatePagination } from '@/commons/http/pagination';
import { getDebtDirection, isDebtOverdue } from '../services/debt.service';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { UserRepository } from '@/repositories/user/user.repo';
import type { ListDebtsContext } from '../types/handler.types';
import type { DebtFindManyOptions } from '@/repositories/debt/debt.repo';
import { apiSuccess } from '@/commons/http/response';

export const list = async ({
  query,
  user,
  debtRepo = new DebtRepository(db),
  userRepo = new UserRepository(db)
}: ListDebtsContext) => {
  const { status, direction, sortBy, sortOrder, page = 1, limit = 20 } = query;

  const filterOptions: DebtFindManyOptions = {
    involvedUserId: user.id,
    limit,
    offset: (page - 1) * limit,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'desc'
  };

  if (status) {
    filterOptions.status = status;
  }

  if (direction === 'LEND') {
    filterOptions.creditorId = user.id;
    delete filterOptions.involvedUserId;
  } else if (direction === 'BORROW') {
    filterOptions.debtorId = user.id;
    delete filterOptions.involvedUserId;
  }

  const result = await debtRepo.findMany(filterOptions);

  // N+1 prevention: batch-fetch user details for all creditor/debtor IDs
  const userIds = [...new Set(
    result.items.flatMap(d => [d.creditorId, d.debtorId]).filter(Boolean) as string[]
  )];
  const users = await userRepo.findByIds(userIds);
  const userMap = new Map(users.map(u => [u.id, { name: u.name, phoneNumber: u.phoneNumber }]));

  const debts = result.items.map((debt) => ({
    ...debt,
    direction: getDebtDirection(user.id, debt.creditorId || '', debt.debtorId || ''),
    overdue: isDebtOverdue(debt.expiresAt ? new Date(debt.expiresAt) : null, debt.status),
    creditorName: debt.creditorId ? userMap.get(debt.creditorId)?.name || null : null,
    debtorName: debt.debtorId ? userMap.get(debt.debtorId)?.name || null : null,
  }));

  return apiSuccess(debts, undefined, calculatePagination(result.pagination.total || 0, page, limit) as unknown as Record<string, unknown>);
};
