/**
 * Service orchestration to suggest an edit on a debt
 */

import { BE_ERRORS } from '@repo/errors';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/activity-logger';
import { onSuggestionReceived } from '@/modules/notification/services/notification-triggers.service';
import type { SuggestEditBody } from '../types/handler.types';
import type { ServiceResult } from './debt.service';

export async function suggestEdit(
  debtId: string,
  body: SuggestEditBody,
  user: any,
  debtRepo: DebtRepository
): Promise<ServiceResult<any>> {
  const debt = await debtRepo.findById(debtId);
  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  // Only counterparty can suggest edits
  if (debt.uploadedById === user.id) {
    return { error: BE_ERRORS.FORBIDDEN };
  }

  // User must be involved
  if (debt.creditorId !== user.id && debt.debtorId !== user.id) {
    return { error: BE_ERRORS.DEBT_PERMISSION_DENIED };
  }

  // Cannot suggest edits on finalized debts
  if (debt.status === 'paid' || debt.status === 'cancelled') {
    return { error: BE_ERRORS.DEBT_INVALID_STATE };
  }

  const { amount, description } = body;
  if (!amount && !description) {
    return { error: { ...BE_ERRORS.INVALID_INPUT, message: 'Amount or description is required to suggest edits' } };
  }

  const updated = await debtRepo.update(debtId, {
    suggestedAmount: amount ?? null,
    suggestedDescription: description ?? null,
    suggestedById: user.id,
    suggestedAt: new Date(),
    updatedAt: new Date()
  });

  logActivity({
    userId: user.id,
    action: 'suggest_edit',
    resource: 'debt',
    resourceId: debtId,
    changes: { after: { suggestedAmount: amount, suggestedDescription: description } }
  });

  onSuggestionReceived(debt, user.id).catch(() => {});

  return { data: updated };
}
