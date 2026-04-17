/**
 * Storage/Upload Request DTOs
 *
 * Validation schemas for file upload endpoints.
 */

import { z } from 'zod';

/**
 * Upload QR code request
 */
export const UploadQRRequest = z.object({
  file: z.instanceof(File),
  debtId: z.string().optional()
});

export type UploadQRRequest = z.infer<typeof UploadQRRequest>;

/**
 * Upload payment proof request
 */
export const UploadPaymentProofRequest = z.object({
  file: z.instanceof(File),
  debtId: z.string(),
  description: z.string().optional()
});

export type UploadPaymentProofRequest = z.infer<typeof UploadPaymentProofRequest>;

/**
 * Reject proof request
 */
export const RejectProofRequest = z.object({
  fileId: z.string(),
  rejectionReason: z.string().min(5, 'Reason must be at least 5 characters')
});

export type RejectProofRequest = z.infer<typeof RejectProofRequest>;

/**
 * Approve proof request
 */
export const ApproveProofRequest = z.object({
  fileId: z.string()
});

export type ApproveProofRequest = z.infer<typeof ApproveProofRequest>;
