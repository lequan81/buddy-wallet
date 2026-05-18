/**
 * Service orchestration to respond to an edit suggestion
 */

import { BE_ERRORS } from '@repo/errors';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/activity-logger';
import { onSuggestionResponded } from '@/modules/notification/services/notification-triggers.service';
import type { RespondSuggestionBody } from '../types/handler.types';
import type { ServiceResult } from './debt.service';

export async function respondSuggestion(
  debtId: string,
  body: RespondSuggestionBody,
  user: any,
  debtRepo: DebtRepository
): Promise<ServiceResult<any>> {
  const debt = await debtRepo.findById(debtId);
  if (!debt) {
    return { error: BE_ERRORS.DEBT_NOT_FOUND };
  }

  // Only uploader can respond
  if (debt.uploadedById !== user.id) {
    return { error: BE_ERRORS.DEBT_PERMISSION_DENIED };
  }

  if (!debt.suggestedById || !debt.suggestedAt) {
    return { error: BE_ERRORS.DEBT_INVALID_STATE };
  }

  const { accept } = body;

  if (accept) {
    const updateData: any = {
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

    const updated = await debtRepo.update(debtId, updateData);

    logActivity({
      userId: user.id,
      action: 'accept_suggestion',
      resource: 'debt',
      resourceId: debtId,
      changes: { after: updateData as unknown as Record<string, unknown> }
    });

    onSuggestionResponded(debt, true).catch(() => {});

    return { data: updated };
  }

  const updated = await debtRepo.update(debtId, {
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
    resourceId: debtId
  });

  onSuggestionResponded(debt, false).catch(() => {});

  return { data: updated };
}
