/**
 * Storage/Upload Request DTOs
 *
 * Validation schemas for file upload endpoints using Valibot.
 */

import * as v from 'valibot';
import {
  uploadQRSchema,
  uploadPaymentProofSchema,
  rejectProofSchema,
  approveProofSchema
} from '@repo/validation';

/**
 * Upload QR code request
 */
export const UploadQRRequest = uploadQRSchema;
export type UploadQRRequest = v.InferInput<typeof UploadQRRequest>;

/**
 * Upload payment proof request
 */
export const UploadPaymentProofRequest = uploadPaymentProofSchema;
export type UploadPaymentProofRequest = v.InferInput<typeof UploadPaymentProofRequest>;

/**
 * Reject proof request
 */
export const RejectProofRequest = rejectProofSchema;
export type RejectProofRequest = v.InferInput<typeof RejectProofRequest>;

/**
 * Approve proof request
 */
export const ApproveProofRequest = approveProofSchema;
export type ApproveProofRequest = v.InferInput<typeof ApproveProofRequest>;

