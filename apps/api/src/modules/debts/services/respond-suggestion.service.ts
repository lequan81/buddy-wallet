/**
 * Service orchestration to respond to an edit suggestion
 */

import { BE_ERRORS } from '@repo/errors';
import type { Debt } from '@repo/types';
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import { logActivity } from '@/commons/logging/activity-logger';
import type { AuthenticatedUser } from '@repo/types/api/handler-context';
import { onSuggestionResponded } from '@/modules/notification/services/notification-triggers.service';
import type { RespondSuggestionBody } from '../types/handler.types';
import type { ServiceResult } from './debt.service';

export async function respondSuggestion(
  debtId: string,
  body: RespondSuggestionBody,
  user: AuthenticatedUser,
  debtRepo: DebtRepository
): Promise<ServiceResult<Debt | null>> {
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
    const updateData = {
      updatedAt: new Date(),
      suggestedAmount: null,
      suggestedDescription: null,
      suggestedById: null,
      suggestedAt: null,
      amount: debt.suggestedAmount !== null ? debt.suggestedAmount : undefined,
      description: debt.suggestedDescription !== null ? debt.suggestedDescription : undefined
    };

    const updated = await debtRepo.update(debtId, updateData);

    logActivity({
      userId: user.id,
      action: 'accept_suggestion',
      resource: 'debt',
      resourceId: debtId,
      changes: { after: updateData as unknown as Record<string, unknown> }
    });

    onSuggestionResponded(debt, { accepted: true }).catch(() => {});

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

  onSuggestionResponded(debt, { accepted: false }).catch(() => {});

  return { data: updated };
}

