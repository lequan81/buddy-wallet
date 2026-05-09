/**
 * Debt Proof Handlers
 * @logicType http
 *
 * Handles payment proof approval and rejection under the debts module.
 * Delegates to the storage proof handler for actual logic.
 */

import { proof as storageProof } from '@/modules/storage/handlers/proof.handler';
import type { ApproveProofContext, RejectProofContext } from '../types/handler.types';

export const debtProof = {
  /** POST /debts/:id/proofs/:proofId/approve */
  approve: async (ctx: ApproveProofContext) => {
    const { proofId } = ctx.params;
    return storageProof.approve({
      ...ctx,
      params: { id: proofId }
    } as Parameters<typeof storageProof.approve>[0]);
  },

  /** POST /debts/:id/proofs/:proofId/reject */
  reject: async (ctx: RejectProofContext) => {
    const { proofId } = ctx.params;
    return storageProof.reject({
      ...ctx,
      params: { id: proofId }
    } as Parameters<typeof storageProof.reject>[0]);
  }
};
