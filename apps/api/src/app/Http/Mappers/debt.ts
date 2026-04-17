/**
 * Debt data transformation layer
 * Maps between entities and DTOs
 */

import type { Debt as DebtEntity } from '@repo/db';
import type { DebtDetails, Debt, SafeUser } from '@repo/types';
import { toSafeUser } from './user';

/**
 * Map a DebtEntity to a Debt DTO
 */
export function toDebt(entity: DebtEntity): Debt {
  return {
    id: entity.id,
    debtorPhone: entity.debtorPhone,
    creditorPhone: entity.creditorPhone,
    debtorId: entity.debtorId,
    creditorId: entity.creditorId,
    uploadedById: entity.uploadedById,
    amount: entity.amount,
    description: entity.description,
    status: entity.status as any,
    confirmedByCreditor: entity.confirmedByCreditor ?? false,
    confirmedByDebtor: entity.confirmedByDebtor ?? false,
    needsConfirmation: entity.needsConfirmation ?? false,
    creditorConfirmedAt: entity.creditorConfirmedAt?.toISOString() ?? null,
    debtorConfirmedAt: entity.debtorConfirmedAt?.toISOString() ?? null,
    hasPendingProof: (entity as any).hasPendingProof ?? false,
    proofCount: (entity as any).proofCount ?? 0,
    lastProofUploadedAt: (entity as any).lastProofUploadedAt?.toISOString() ?? null,
    expiresAt: entity.expiresAt?.toISOString() ?? null,
    suggestedAmount: entity.suggestedAmount,
    suggestedDescription: entity.suggestedDescription,
    suggestedById: entity.suggestedById,
    suggestedAt: entity.suggestedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    deletedAt: entity.deletedAt?.toISOString() ?? null,
    lastSyncAt: null,
  };
}

/**
 * Map a DebtEntity to DebtDetails DTO with optional related users
 */
export function toDebtDetails(
  entity: DebtEntity,
  options?: {
    debtor?: any;
    creditor?: any;
    uploader?: any;
  }
): DebtDetails {
  const debt = toDebt(entity);

  return {
    ...debt,
    debtor: options?.debtor ? toSafeUser(options.debtor) : null,
    creditor: options?.creditor ? toSafeUser(options.creditor) : null,
    uploader: options?.uploader ? toSafeUser(options.uploader) : null,
  };
}

/**
 * Map array of DebtEntity to array of Debt DTO
 */
export function toDebts(entities: DebtEntity[]): Debt[] {
  return entities.map(toDebt);
}

/**
 * Map array of DebtEntity to array of DebtDetails DTO
 */
export function toDebtDetailsList(
  entities: DebtEntity[],
  usersMap?: Map<string, any>
): DebtDetails[] {
  return entities.map(entity => {
    const debtor = entity.debtorId ? usersMap?.get(entity.debtorId) : null;
    const creditor = entity.creditorId ? usersMap?.get(entity.creditorId) : null;
    const uploader = usersMap?.get(entity.uploadedById);

    return toDebtDetails(entity, { debtor, creditor, uploader });
  });
}
