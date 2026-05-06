/**
 * Payment Proof Handlers
 * @logicType http
 *
 * Handles payment proof upload, approval, and rejection.
 * Uses existing debt fields: hasPendingProof, proofCount, lastProofUploadedAt.
 *
 * File upload + debt update are wrapped in a transaction for atomicity.
 */

import { db } from '@/providers/database';
import { uploadStorage } from '@/providers/storage';
import { FileRepository } from '@/repositories/storage/file.repo';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { BE_ERRORS } from '@repo/errors';
import { validateFileType, validateFileSize, generateFileKey } from '../services/storage.service';
import { apiSuccess, apiError, apiCreated } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';
import type { UploadProofContext, ApproveProofContext, RejectProofContext } from '../types/handler.types';
import { logger } from '@repo/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const proof = {
  /** POST /storage/payment-proof/:debtId */
  upload: async ({ params, body, user }: UploadProofContext) => {
    const { debtId } = params;
    const { file } = body;

    // Pre-transaction: validate debt and file
    const debtRepo = new DebtRepository(db);
    const debt = await debtRepo.findById(debtId);
    if (!debt) {
      return apiError(BE_ERRORS.DEBT_NOT_FOUND);
    }

    if (debt.creditorId !== user.id && debt.debtorId !== user.id) {
      return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
    }

    const typeV = validateFileType(file.type, ALLOWED_IMAGE_TYPES);
    if ('code' in typeV) { return apiError(BE_ERRORS.FILE_INVALID_TYPE, typeV.error); }
    const sizeV = validateFileSize(file.size, MAX_FILE_SIZE);
    if ('code' in sizeV) { return apiError(BE_ERRORS.FILE_TOO_LARGE, sizeV.error); }

    // Upload file to storage (outside transaction — S3/filesystem is not transactional)
    const key = generateFileKey(user.id, `proof-${debtId}-${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await uploadStorage.save(key, buffer);

    // Transaction: create file metadata + update debt proof tracking atomically
    try {
      const result = await db.transaction(async (tx) => {
        const txFileRepo = new FileRepository(tx);
        const txDebtRepo = new DebtRepository(tx);

        const metadata = await txFileRepo.createUpload({
          uploadedById: user.id,
          storagePath: key,
          mimeType: file.type,
          sizeBytes: file.size
        });

        await txDebtRepo.update(debtId, {
          hasPendingProof: true,
          proofCount: (debt.proofCount || 0) + 1,
          lastProofUploadedAt: new Date(),
          updatedAt: new Date()
        });

        return metadata;
      });

      logActivity({
        userId: user.id,
        action: 'upload',
        resource: 'file',
        resourceId: result.id,
        metadata: { debtId, type: 'payment_proof' }
      });

      return apiCreated({
        id: result.id,
        key: result.storagePath,
        url: uploadStorage.resolvePath(result.storagePath),
        size: result.sizeBytes,
        contentType: result.mimeType,
        uploadedAt: result.createdAt
      }, 'Payment proof uploaded');
    } catch (txErr) {
      logger.error('Transaction failed for proof upload', { debtId, userId: user.id, error: String(txErr) });
      // Rollback: delete uploaded file if DB transaction fails
      await uploadStorage.delete(key).catch((deleteErr) => {
        logger.warn('Failed to cleanup file after transaction failure', { key, error: String(deleteErr) });
      });
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, 'File upload failed due to transaction error');
    }
  },

  /** POST /storage/proof/:id/approve */
  approve: async ({ params, user }: ApproveProofContext) => {
    const { id } = params;

    const fileRepo = new FileRepository(db);
    const file = await fileRepo.findById(id);
    if (!file) {
      return apiError(BE_ERRORS.FILE_NOT_FOUND);
    }

    // TODO: When payment_proofs table is added, update proof status and
    // check if all proofs for the debt are approved → auto-mark debt as 'paid'

    logActivity({
      userId: user.id,
      action: 'approve',
      resource: 'file',
      resourceId: id
    });

    return apiSuccess({ approved: true, id }, 'Payment proof approved');
  },

  /** POST /storage/proof/:id/reject */
  reject: async ({ params, body, user }: RejectProofContext) => {
    const { id } = params;
    const { reason } = body;

    const fileRepo = new FileRepository(db);
    const file = await fileRepo.findById(id);
    if (!file) {
      return apiError(BE_ERRORS.FILE_NOT_FOUND);
    }

    logActivity({
      userId: user.id,
      action: 'reject',
      resource: 'file',
      resourceId: id,
      metadata: { reason }
    });

    return apiSuccess({ rejected: true, id, reason }, 'Payment proof rejected');
  }
};
