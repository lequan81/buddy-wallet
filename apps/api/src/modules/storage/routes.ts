/**
 * Storage Routes
 * @logicType http
 */

import { Elysia, t } from 'elysia';
import { DeleteFileSchema, ListFilesQuerySchema } from './schema';
import { storage } from './handlers/storage.handler';
import { proof } from './handlers/proof.handler';
import { requirePermission } from '@/commons/http/require-user';

export const storageRoutes = new Elysia({ prefix: '/storage' })
  .post('/upload', requirePermission('storage:upload', storage.upload), {
    body: t.Object({ file: t.File() }),
    detail: { tags: ['storage'], description: 'Upload a file' }
  })
  .delete('/file', requirePermission('storage:delete-own', storage.remove), {
    body: DeleteFileSchema,
    detail: { tags: ['storage'], description: 'Delete a file' }
  })
  .get('/file/:key', requirePermission('storage:view-own', storage.getUrl), {
    params: t.Object({ key: t.String() }),
    detail: { tags: ['storage'], description: 'Get file URL' }
  })
  .get('/files', requirePermission('storage:view-own', storage.list), {
    query: ListFilesQuerySchema,
    detail: { tags: ['storage'], description: 'List user files' }
  })
  // Payment Proof routes
  .post('/payment-proof/:debtId', requirePermission('proof:upload', proof.upload), {
    params: t.Object({ debtId: t.String() }),
    body: t.Object({ file: t.File() }),
    detail: { tags: ['storage', 'proofs'], description: 'Upload payment proof for a debt' }
  })
  .post('/proof/:id/approve', requirePermission('proof:approve', proof.approve), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['storage', 'proofs'], description: 'Approve a payment proof' }
  })
  .post('/proof/:id/reject', requirePermission('proof:reject', proof.reject), {
    params: t.Object({ id: t.String() }),
    body: t.Object({ reason: t.Optional(t.String()) }),
    detail: { tags: ['storage', 'proofs'], description: 'Reject a payment proof' }
  });
