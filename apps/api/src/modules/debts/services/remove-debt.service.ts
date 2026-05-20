/**
 * Service orchestration to delete/remove cancelled debts
 */

import { BE_ERRORS } from '@repo/errors';
import type { Debt } from '@repo/db';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/logging/activity-logger';
import type { AuthenticatedUser } from '@repo/types/api/handler-context';
import { SHARED_CONSTANTS } from '@repo/config';
import type { ServiceResult } from './debt.service';

/**
 * Business orchestration to soft delete a cancelled debt
 */
export async function removeDebt(
  debtId: string,
  user: AuthenticatedUser,
  debtRepo: DebtRepository
): Promise<ServiceResult<{ deleted: boolean }>> {
  const debt = await debtRepo.findById(debtId);

  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  if (debt.creditorId !== user.id) {
    return { error: BE_ERRORS.DEBT_PERMISSION_DENIED };
  }

  if (debt.status !== 'cancelled') {
    return { error: BE_ERRORS.DEBT_INVALID_STATE };
  }

  await debtRepo.softDelete(debtId, new Date());

  logActivity({
    userId: user.id,
    action: 'delete',
    resource: 'debt',
    resourceId: debtId
  });

  return { data: { deleted: true } };
}

/**
 * Business orchestration to batch soft delete cancelled debts
 */
export async function batchRemoveDebts(
  ids: string[],
  user: AuthenticatedUser,
  debtRepo: DebtRepository
): Promise<ServiceResult<{ deleted: string[]; notFound: string[] }>> {
  if (ids.length > SHARED_CONSTANTS.DEBT.MAX_BATCH_DELETE) {
    return {
      error: {
        code: 'BAD_REQUEST',
        message: `Cannot delete more than ${SHARED_CONSTANTS.DEBT.MAX_BATCH_DELETE} debts at once`,
        status: 400
      }
    };
  }

  const debts = await debtRepo.findByIds(ids);
  if (debts.length === 0) {
    return { data: { deleted: [], notFound: ids } };
  }

  const eligibleIds = debts
    .filter(d => d.creditorId === user.id && d.status === 'cancelled')
    .map(d => d.id);

  if (eligibleIds.length === 0) {
    return { error: BE_ERRORS.DEBT_PERMISSION_DENIED };
  }

  const { deleted, notFound } = await debtRepo.batchSoftDelete(eligibleIds, new Date());

  for (const id of deleted) {
    logActivity({
      userId: user.id,
      action: 'delete',
      resource: 'debt',
      resourceId: id
    });
  }

  const actuallyNotFound = [...notFound, ...ids.filter(id => !eligibleIds.includes(id) && !notFound.includes(id))];

  return { data: { deleted, notFound: actuallyNotFound } };
}

/**
 * Business orchestration to remove all cancelled debts
 */
export async function removeAllDebts(
  confirm: string | undefined,
  user: AuthenticatedUser,
  debtRepo: DebtRepository
): Promise<ServiceResult<{ deleted: number }>> {
  if (confirm !== 'true') {
    return { error: { code: 'BAD_REQUEST', message: 'Must confirm deletion', status: 400 } };
  }

  const { items: debts } = await debtRepo.findMany({
    creditorId: user.id,
    status: 'cancelled',
    limit: 1000
  });

  if (debts.length === 0) {
    return { data: { deleted: 0 } };
  }

  const ids = debts.map((d) => d.id);
  const { deleted } = await debtRepo.batchSoftDelete(ids, new Date());

  logActivity({
    userId: user.id,
    action: 'delete_all',
    resource: 'debt',
    resourceId: 'all_cancelled'
  });

  return { data: { deleted: deleted.length } };
}

