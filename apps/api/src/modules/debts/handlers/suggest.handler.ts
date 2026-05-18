import { BE_ERRORS } from '@repo/errors';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';
import type { SuggestEditContext } from '../types/handler.types';
import { onSuggestionReceived } from '@/modules/notification/services/notification-triggers.service';

export const suggest = async ({
  params,
  body,
  user,
  debtRepo = new DebtRepository(db)
}: SuggestEditContext) => {
  const debt = await debtRepo.findById(params.id);
  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
  }

  // Only counterparty (not the creator/uploader) can suggest edits
  if (debt.uploadedById === user.id) {
    return apiError(BE_ERRORS.FORBIDDEN);
  }

  // User must be involved in the debt
  if (debt.creditorId !== user.id && debt.debtorId !== user.id) {
    return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
  }

  // Cannot suggest edits on finalized debts
  if (debt.status === 'paid' || debt.status === 'cancelled') {
    return apiError(BE_ERRORS.DEBT_INVALID_STATE);
  }

  const { amount, description } = body;

  if (!amount && !description) {
    return apiError(BE_ERRORS.INVALID_INPUT, 'Amount or description is required to suggest edits');
  }

  const updated = await debtRepo.update(params.id, {
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
    resourceId: params.id,
    changes: { after: { suggestedAmount: amount, suggestedDescription: description } }
  });

  // Fire-and-forget: notify debt uploader
  onSuggestionReceived(debt, user.id).catch(() => {});

  return apiSuccess(updated, 'Edit suggestion submitted');
};
