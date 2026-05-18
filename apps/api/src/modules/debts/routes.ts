/**
 * Debts Routes
 * @logicType http
 *
 * Permission-based access control using requirePermission wrapper.
 */

import { Elysia } from 'elysia';
import * as v from 'valibot';
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
import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { UserRepository } from '@/repositories/user/user.repo';

export const debtRoutes = new Elysia({ prefix: '/debts' })
  .decorate('debtRepo', new DebtRepository(db))
  .decorate('userRepo', new UserRepository(db))
  .post('/', requirePermission('debt:create', debt.create), {
    body: CreateDebtSchema,
    detail: { tags: ['debts'], description: 'Create a new debt' }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Elysia handler type incompatibility
  .delete('/batch', requirePermission('debt:delete-own', debt.batchRemove) as any, {
    body: BatchDeleteSchema,
    detail: { tags: ['debts'], description: 'Batch delete debts' }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Elysia handler type incompatibility
  .delete('/all', requirePermission('debt:delete-own', debt.removeAll) as any, {
    query: DeleteAllQuerySchema,
    detail: { tags: ['debts'], description: 'Delete all eligible debts' }
  })
  .get('/', requirePermission('debt:view-own', debt.list), {
    query: ListDebtsQuerySchema,
    detail: { tags: ['debts'], description: 'List debts for current user' }
  })
  .get('/:id', requirePermission('debt:view-own', debt.get), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['debts'], description: 'Get debt by ID' }
  })
  .patch('/:id', requirePermission('debt:update-own', debt.update), {
    params: v.object({ id: v.string() }),
    body: UpdateDebtSchema,
    detail: { tags: ['debts'], description: 'Update debt details' }
  })
  .post('/:id/cancel', requireUser(debt.cancel), {
    params: v.object({ id: v.string() }),
    body: CancelDebtSchema,
    detail: { tags: ['debts'], description: 'Cancel a debt' }
  })
  .post('/:id/confirm', requireUser(debt.confirm), {
    params: v.object({ id: v.string() }),
    body: ConfirmDebtSchema,
    detail: { tags: ['debts'], description: 'Confirm a debt' }
  })
  .post('/:id/complete', requireUser(debt.complete), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['debts'], description: 'Mark debt as paid' }
  })
  .post('/:id/suggest', requireUser(debt.suggest), {
    params: v.object({ id: v.string() }),
    body: SuggestEditSchema,
    detail: { tags: ['debts'], description: 'Suggest an edit to a debt' }
  })
  .post('/:id/suggestion/respond', requireUser(debt.respondSuggestion), {
    params: v.object({ id: v.string() }),
    body: RespondSuggestionSchema,
    detail: { tags: ['debts'], description: 'Accept or reject a debt suggestion' }
  })
  .get('/:id/qr', requireUser(debt.qr.generate), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['debts'], description: 'Generate VietQR payment URL for a debt' }
  })
  .delete('/:id', requirePermission('debt:delete-own', debt.remove), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['debts'], description: 'Delete a cancelled debt' }
  });
