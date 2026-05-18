import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { apiSuccess, apiError } from '@/commons/http/response';
import type { RespondSuggestionContext } from '../types/handler.types';
import { respondSuggestion as respondSuggestionService } from '../services/debt.service';

export const respondSuggestion = async ({
  params,
  body,
  user,
  debtRepo = new DebtRepository(db)
}: RespondSuggestionContext) => {
  const result = await respondSuggestionService(params.id, body, user, debtRepo);
  if ('error' in result) {
    return apiError(result.error);
  }
  
  const accept = body.accept;
  const message = accept ? 'Suggestion accepted and applied' : 'Suggestion rejected';
  return apiSuccess(result.data, message);
};
