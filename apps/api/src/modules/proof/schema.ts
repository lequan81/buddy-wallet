/**
 * Proof Schema Definitions
 * 
 * Valibot definitions for proof-related validation.
 */

import * as v from 'valibot';

export const RejectProofSchema = v.object({
  reason: v.optional(v.pipe(v.string(), v.maxLength(500)))
});

export const DebtIdParamSchema = v.object({
  debtId: v.pipe(v.string(), v.minLength(1))
});

export const ProofIdParamSchema = v.object({
  proofId: v.pipe(v.string(), v.minLength(1))
});
