import { BE_ERRORS } from '@repo/errors';
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { apiSuccess, apiError } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';
import type { RespondSuggestionContext, DebtUpdateData } from '../types/handler.types';
import { onSuggestionResponded } from '@/modules/notification/services/notification-triggers.service';

export const respondSuggestion = async ({
  params,
  body,
  user,
  debtRepo = new DebtRepository(db)
}: RespondSuggestionContext) => {
  const debt = await debtRepo.findById(params.id);
  if (!debt) {
    return apiError(BE_ERRORS.DEBT_NOT_FOUND);
  }

  // Only the creator/uploader can respond to suggestions
  if (debt.uploadedById !== user.id) {
    return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
  }

  // Check pending suggestion exists
  if (!debt.suggestedById || !debt.suggestedAt) {
    return apiError(BE_ERRORS.DEBT_INVALID_STATE);
  }

  const { accept } = body;

  if (accept) {
    // Apply suggestion to debt
    const updateData: Parameters<typeof debtRepo.update>[1] = {
      updatedAt: new Date(),
      suggestedAmount: null,
      suggestedDescription: null,
      suggestedById: null,
      suggestedAt: null
    };

    if (debt.suggestedAmount !== null) {
      updateData.amount = debt.suggestedAmount;
    }
    if (debt.suggestedDescription !== null) {
      updateData.description = debt.suggestedDescription;
    }

    const updated = await debtRepo.update(params.id, updateData);

    logActivity({
      userId: user.id,
      action: 'accept_suggestion',
      resource: 'debt',
      resourceId: params.id,
      changes: { after: updateData as unknown as Record<string, unknown> }
    });

    // Fire-and-forget: notify suggester
    onSuggestionResponded(debt, true).catch(() => {});

    return apiSuccess(updated, 'Suggestion accepted and applied');
  }

  // Reject: clear suggestion fields
  const updated = await debtRepo.update(params.id, {
    suggestedAmount: null,
    suggestedDescription: null,
    suggestedById: null,
    suggestedAt: null,
    updatedAt: new Date()
  });

  logActivity({
    userId: user.id,
    action: 'reject_suggestion',
    resource: 'debt',
    resourceId: params.id
  });

  // Fire-and-forget: notify suggester
  onSuggestionResponded(debt, false).catch(() => {});

  return apiSuccess(updated, 'Suggestion rejected');
};
