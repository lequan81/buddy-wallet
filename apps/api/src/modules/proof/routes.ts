/**
 * Proof Routes
 * @logicType http
 *
 * Dedicated routes for payment proof operations.
 * Separated from debts and storage modules for cleaner architecture.
 *
 * NOTE: Elysia's router (memoirist) requires consistent parameter names at
 * the same path level. All /proof/:id/... routes use `:id` to avoid conflicts.
 * Handlers remap `params.id` to the appropriate semantic name.
 */

import { Elysia, t } from 'elysia';
import * as v from 'valibot';
import { proof } from './handlers/proof.handler';
import { RejectProofSchema } from './schema';
import { requirePermission } from '@/commons/http/require-user';

export const proofRoutes = new Elysia({ prefix: '/proof' })
  .post('/:id/upload', requirePermission('proof:upload', proof.upload), {
    params: v.object({ id: v.string() }),
    body: t.Object({ file: t.File() }),
    detail: { tags: ['proofs'], description: 'Upload payment proof for a debt' }
  })
  .post('/:id/approve', requirePermission('proof:approve', proof.approve), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['proofs'], description: 'Approve a payment proof' }
  })
  .post('/:id/reject', requirePermission('proof:reject', proof.reject), {
    params: v.object({ id: v.string() }),
    body: RejectProofSchema,
    detail: { tags: ['proofs'], description: 'Reject a payment proof' }
  })
  .get('/:id', requirePermission('debt:view-own', proof.list), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['proofs'], description: 'List payment proofs for a debt' }
  });
