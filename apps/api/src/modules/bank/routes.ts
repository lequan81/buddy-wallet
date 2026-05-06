/**
 * Bank Routes
 * @logicType http
 */

import { Elysia, t } from 'elysia';
import {
  CreateBankAccountSchema,
  UpdateBankAccountSchema,
  ListBankAccountsQuerySchema
} from './schema';
import { bank } from './handlers/bank.handler';
import { requirePermission } from '@/commons/http/require-user';

export const bankRoutes = new Elysia({ prefix: '/bank' })
  .post('/accounts', requirePermission('bank:create', bank.create), {
    body: CreateBankAccountSchema,
    detail: { tags: ['bank'], description: 'Create a new bank account' }
  })
  .get('/accounts', requirePermission('bank:view-own', bank.list), {
    query: ListBankAccountsQuerySchema,
    detail: { tags: ['bank'], description: 'List user bank accounts' }
  })
  .get('/accounts/:id', requirePermission('bank:view-own', bank.get), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['bank'], description: 'Get bank account by ID' }
  })
  .patch('/accounts/:id', requirePermission('bank:update-own', bank.update), {
    params: t.Object({ id: t.String() }),
    body: UpdateBankAccountSchema,
    detail: { tags: ['bank'], description: 'Update bank account' }
  })
  .delete('/accounts/:id', requirePermission('bank:delete-own', bank.remove), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['bank'], description: 'Delete bank account' }
  })
  .post('/accounts/:id/set-default', requirePermission('bank:update-own', bank.setDefault), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['bank'], description: 'Set bank account as default' }
  });
