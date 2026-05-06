/**
 * Debts Routes
 * @logicType http
 *
 * Permission-based access control using requirePermission wrapper.
 */

import { Elysia, t } from 'elysia';
import {
  CreateDebtSchema,
  UpdateDebtSchema,
  CancelDebtSchema,
  ConfirmDebtSchema,
  ListDebtsQuerySchema,
  SuggestEditSchema,
  RespondSuggestionSchema,
  BatchDeleteSchema,
  DeleteAllQuerySchema
} from './schema';
import { debt } from './handlers';
import { requireUser, requirePermission } from '@/commons/http/require-user';

export const debtRoutes = new Elysia({ prefix: '/debts' })
  .post('/', requirePermission('debt:create', debt.create), {
    body: CreateDebtSchema,
    detail: { tags: ['debts'], description: 'Create a new debt' }
  })
  .delete('/batch', requirePermission('debt:delete-own', debt.batchRemove), {
    body: BatchDeleteSchema,
    detail: { tags: ['debts'], description: 'Batch delete debts' }
  })
  .delete('/all', requirePermission('debt:delete-own', debt.removeAll), {
    query: DeleteAllQuerySchema,
    detail: { tags: ['debts'], description: 'Delete all eligible debts' }
  })
  .get('/', requirePermission('debt:view-own', debt.list), {
    query: ListDebtsQuerySchema,
    detail: { tags: ['debts'], description: 'List debts for current user' }
  })
  .get('/:id', requirePermission('debt:view-own', debt.get), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['debts'], description: 'Get debt by ID' }
  })
  .patch('/:id', requirePermission('debt:update-own', debt.update), {
    params: t.Object({ id: t.String() }),
    body: UpdateDebtSchema,
    detail: { tags: ['debts'], description: 'Update debt details' }
  })
  .post('/:id/cancel', requireUser(debt.cancel), {
    params: t.Object({ id: t.String() }),
    body: CancelDebtSchema,
    detail: { tags: ['debts'], description: 'Cancel a debt' }
  })
  .post('/:id/confirm', requireUser(debt.confirm), {
    params: t.Object({ id: t.String() }),
    body: ConfirmDebtSchema,
    detail: { tags: ['debts'], description: 'Confirm a debt' }
  })
  .post('/:id/complete', requireUser(debt.complete), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['debts'], description: 'Mark debt as paid' }
  })
  .post('/:id/suggest', requireUser(debt.suggest), {
    params: t.Object({ id: t.String() }),
    body: SuggestEditSchema,
    detail: { tags: ['debts'], description: 'Suggest an edit to a debt' }
  })
  .post('/:id/suggestion/respond', requireUser(debt.respondSuggestion), {
    params: t.Object({ id: t.String() }),
    body: RespondSuggestionSchema,
    detail: { tags: ['debts'], description: 'Accept or reject a debt suggestion' }
  })
  .get('/:id/qr', requireUser(debt.qr.generate), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['debts'], description: 'Generate VietQR payment URL for a debt' }
  })
  .delete('/:id', requirePermission('debt:delete-own', debt.remove), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['debts'], description: 'Delete a cancelled debt' }
  });
