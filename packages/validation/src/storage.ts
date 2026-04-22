import * as v from 'valibot';

/**
 * Upload QR code Schema
 */
export const uploadQRSchema = v.strictObject({
  file: v.any(), // Use any() to allow File/Blob/Buffer across environments
  debtId: v.optional(v.string())
});

/**
 * Upload Payment Proof Schema
 */
export const uploadPaymentProofSchema = v.strictObject({
  file: v.any(),
  debtId: v.string(),
  description: v.optional(v.string())
});

/**
 * Reject Proof Schema
 */
export const rejectProofSchema = v.strictObject({
  fileId: v.string(),
  rejectionReason: v.pipe(v.string(), v.minLength(5, 'Reason must be at least 5 characters'))
});

/**
 * Approve Proof Schema
 */
export const approveProofSchema = v.strictObject({
  fileId: v.string()
});

export type UploadQRInput = v.InferInput<typeof uploadQRSchema>;
export type UploadPaymentProofInput = v.InferInput<typeof uploadPaymentProofSchema>;
export type RejectProofInput = v.InferInput<typeof rejectProofSchema>;
export type ApproveProofInput = v.InferInput<typeof approveProofSchema>;
