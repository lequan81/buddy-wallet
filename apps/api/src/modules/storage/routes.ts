/**
 * Storage Routes
 * @logicType http
 */

import { Elysia, t } from 'elysia';
import * as v from 'valibot';
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
    params: v.object({ key: v.string() }),
    detail: { tags: ['storage'], description: 'Get file URL' }
  })
  .get('/files', requirePermission('storage:view-own', storage.list), {
    query: ListFilesQuerySchema,
    detail: { tags: ['storage'], description: 'List user files' }
  })
  // Payment Proof routes — now handled by dedicated /v1/proof module
  .post('/payment-proof/:debtId', requirePermission('proof:upload', proof.upload), {
    params: v.object({ debtId: v.string() }),
    body: t.Object({ file: t.File() }),
    detail: { tags: ['storage', 'proofs'], description: 'Upload payment proof for a debt' }
  });
