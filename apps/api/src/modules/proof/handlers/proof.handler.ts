/**
 * Proof Handlers
 * @logicType http
 *
 * Handles payment proof upload, approval, rejection, and listing.
 * Delegates to existing storage proof handler for actual logic.
 *
 * All routes use `params.id` (Elysia requires consistent param names).
 * `params.id` is interpreted contextually by each handler.
 */

import { proof as storageProof } from '@/modules/storage/handlers/proof.handler';
import type {
  UploadProofContext,
  ApproveProofContext,
  RejectProofContext,
  ListProofsContext
} from '../types/handler.types';

export const proof = {
  /** POST /proof/:id/upload — Upload payment proof (params.id = debtId) */
  upload: async (ctx: UploadProofContext) => {
    // Map params.id to params.debtId for the storage handler
    return storageProof.upload({
      ...ctx,
      params: { debtId: ctx.params.id }
    } as unknown as import('@/modules/storage/types/handler.types').UploadProofContext);
  },

  /** POST /proof/:id/approve — Approve a payment proof (params.id = proofId) */
  approve: async (ctx: ApproveProofContext) => {
    // Storage handler expects params.id — now directly matches
    return storageProof.approve(ctx);
  },

  /** POST /proof/:id/reject — Reject a payment proof (params.id = proofId) */
  reject: async (ctx: RejectProofContext) => {
    // Storage handler expects params.id — now directly matches
    return storageProof.reject(ctx);
  },

  /** GET /proof/:id — List proofs for a debt (params.id = debtId) */
  list: async ({ params, user }: ListProofsContext) => {
    // TODO: Implement when payment_proofs table is added
    return { proofs: [], debtId: params.id, userId: user.id };
  }
};
