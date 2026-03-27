import { fileMetadata, debts, eq, and } from '@repo/db';
import { cache } from '@/plugins/redis';
import { log } from '@repo/logger';
import {
  MAX_IMAGE_FILE_SIZE,
  ACCEPTED_IMAGE_MIME_TYPES,
  UPLOAD_TMP_DIR,
  PROOF_TMP_DIR
} from '@repo/config';
import { isValidImageBytes } from '@repo/utils';
import type { DbClient } from '@/types';
import type { FileType, FileStatus, FileMetadata } from '@repo/db';
import { DiskStorageService } from './storage.service';
import type { IStorageService } from '@/types';
import { ImageService } from './image.service';

const IMAGE_CACHE_TTL = 3600; // 1 hour

export class FileService {
  private uploadStorage: IStorageService;
  private proofStorage: IStorageService;
  private imageService: ImageService;

  constructor(
    private db: DbClient,
    uploadStorage?: IStorageService,
    proofStorage?: IStorageService,
    imageService?: ImageService
  ) {
    this.uploadStorage = uploadStorage || new DiskStorageService(UPLOAD_TMP_DIR);
    this.proofStorage = proofStorage || new DiskStorageService(PROOF_TMP_DIR);
    this.imageService = imageService || new ImageService();
    this.ensureDirs();
  }

  private async ensureDirs() {
    // Basic init - could be moved to storage provider init
    // await this.storage.init(); // If needed in future
  }

  async uploadFile(
    file: File,
    userId: string,
    type: FileType,
    relatedDebtId?: string
  ): Promise<{ success: boolean; error?: string; file?: FileMetadata }> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Validation
      if (file.size > MAX_IMAGE_FILE_SIZE) {
        return {
          success: false,
          error: `File too large. Max size: ${MAX_IMAGE_FILE_SIZE / 1024 / 1024}MB`
        };
      }
      if (
        !ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])
      ) {
        return {
          success: false,
          error: `Invalid file type. Allowed: ${ACCEPTED_IMAGE_MIME_TYPES.join(', ')}`
        };
      }
      if (!isValidImageBytes(new Uint8Array(buffer))) {
        return { success: false, error: 'Invalid image format' };
      }

      // Process
      const processedBuffer = await this.imageService.process(buffer);

      // Save
      const id = Bun.randomUUIDv7();
      const filename = `${id}.webp`;
      const relativePath = `${filename}`; // Storage handles the base directory now

      const targetStorage = type === 'payment_proof' ? this.proofStorage : this.uploadStorage;
      await targetStorage.save(relativePath, processedBuffer);

      // Metadata
      const now = new Date();
      const metadata: typeof fileMetadata.$inferInsert = {
        id,
        filename,
        originalName: file.name,
        mimeType: 'image/webp',
        sizeBytes: processedBuffer.length,
        storagePath: relativePath,
        uploadedById: userId,
        fileType: type,
        relatedDebtId,
        status: type === 'qr_code' ? 'approved' : 'pending',
        createdAt: now
      };

      try {
        this.db.insert(fileMetadata).values(metadata).run();

        // Update debt proof tracking if this is a payment proof
        if (type === 'payment_proof' && relatedDebtId) {
          const debt = this.db.select().from(debts).where(eq(debts.id, relatedDebtId)).get();
          if (debt) {
            this.db
              .update(debts)
              .set({
                hasPendingProof: true,
                proofCount: (debt.proofCount || 0) + 1,
                lastProofUploadedAt: now,
                updatedAt: now
              })
              .where(eq(debts.id, relatedDebtId))
              .run();
            log.debug('FILE', 'Updated debt proof tracking', { debtId: relatedDebtId });
          }
        }
      } catch (dbError) {
        const targetStorage = type === 'payment_proof' ? this.proofStorage : this.uploadStorage;
        await targetStorage.delete(relativePath);
        throw dbError;
      }

      log.debug('FILE', 'Uploaded', { id, type, size: processedBuffer.length });
      return { success: true, file: metadata as FileMetadata };
    } catch (err) {
      log.error('FILE', 'Upload failed', { error: String(err) });
      return { success: false, error: 'Failed to process file' };
    }
  }

  async getFile(
    fileId: string,
    requestingUserId: string,
    isAdmin = false
  ): Promise<{
    success: boolean;
    error?: string;
    data?: Buffer;
    mimeType?: string;
    metadata?: FileMetadata;
  }> {
    const metadata = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();
    if (!metadata) return { success: false, error: 'File not found' };

    // Ownership / relationship check
    if (!isAdmin && metadata.uploadedById !== requestingUserId) {
      if (metadata.relatedDebtId) {
        const debt = this.db.select().from(debts).where(eq(debts.id, metadata.relatedDebtId)).get();
        if (!debt || (debt.debtorId !== requestingUserId && debt.creditorId !== requestingUserId)) {
          return { success: false, error: 'Access denied' };
        }
      } else {
        // No related debt and not the uploader — deny
        return { success: false, error: 'Access denied' };
      }
    }

    // QR codes are viewable by owner only (not debt parties)
    if (metadata.fileType === 'qr_code' && metadata.uploadedById !== requestingUserId && !isAdmin) {
      return { success: false, error: 'Access denied' };
    }

    const cacheKey = `file:${fileId}`;
    const cached = await cache.get<string>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: Buffer.from(cached, 'base64'),
        mimeType: metadata.mimeType,
        metadata
      };
    }

    try {
      // Use storage provider's read() method
      const targetStorage =
        metadata.fileType === 'payment_proof' ? this.proofStorage : this.uploadStorage;
      const data = await targetStorage.read(metadata.storagePath);
      await cache.set(cacheKey, data.toString('base64'), IMAGE_CACHE_TTL);

      return { success: true, data, mimeType: metadata.mimeType, metadata };
    } catch {
      return { success: false, error: 'File not found on disk' };
    }
  }

  async getUserQRCodes(userId: string): Promise<FileMetadata[]> {
    return this.db
      .select()
      .from(fileMetadata)
      .where(and(eq(fileMetadata.uploadedById, userId), eq(fileMetadata.fileType, 'qr_code')))
      .all();
  }

  async getPendingProofs(debtId: string): Promise<FileMetadata[]> {
    return this.db
      .select()
      .from(fileMetadata)
      .where(
        and(
          eq(fileMetadata.relatedDebtId, debtId),
          eq(fileMetadata.fileType, 'payment_proof'),
          eq(fileMetadata.status, 'pending')
        )
      )
      .all();
  }

  async getProofsForDebt(debtId: string): Promise<FileMetadata[]> {
    return this.db
      .select()
      .from(fileMetadata)
      .where(
        and(eq(fileMetadata.relatedDebtId, debtId), eq(fileMetadata.fileType, 'payment_proof'))
      )
      .orderBy(fileMetadata.createdAt)
      .all();
  }

  async approveProof(
    fileId: string,
    reviewerId: string
  ): Promise<{
    success: boolean;
    error?: string;
    allProofsApproved?: boolean;
    debtId?: string;
    uploaderId?: string;
  }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();

    if (!file) return { success: false, error: 'File not found' };
    if (file.fileType !== 'payment_proof') return { success: false, error: 'Not a payment proof' };
    if (file.status !== 'pending') return { success: false, error: 'Already reviewed' };
    if (!file.relatedDebtId) return { success: false, error: 'No related debt found' };

    const debt = this.db.select().from(debts).where(eq(debts.id, file.relatedDebtId)).get();
    if (!debt) return { success: false, error: 'Related debt not found' };

    if (debt.creditorId !== reviewerId) {
      return { success: false, error: 'Only creditor can approve payment proofs' };
    }

    this.db
      .update(fileMetadata)
      .set({
        status: 'approved' as FileStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date()
      })
      .where(eq(fileMetadata.id, fileId))
      .run();

    // Recalculate pending proofs for this debt
    const remainingPending = this.db
      .select()
      .from(fileMetadata)
      .where(
        and(
          eq(fileMetadata.relatedDebtId, file.relatedDebtId),
          eq(fileMetadata.fileType, 'payment_proof'),
          eq(fileMetadata.status, 'pending')
        )
      )
      .all();

    // Check if all proofs are now approved (no pending left)
    const allProofsApproved = remainingPending.length === 0;

    // Clear hasPendingProof if no more pending proofs
    if (allProofsApproved) {
      this.db
        .update(debts)
        .set({ hasPendingProof: false })
        .where(eq(debts.id, file.relatedDebtId))
        .run();
      log.debug('FILE', 'Cleared hasPendingProof for debt', { debtId: file.relatedDebtId });
    }

    log.debug('FILE', 'Proof approved', { fileId, reviewerId, allProofsApproved });
    return {
      success: true,
      allProofsApproved,
      debtId: file.relatedDebtId,
      uploaderId: file.uploadedById
    };
  }

  async rejectProof(
    fileId: string,
    reviewerId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; debtId?: string; uploaderId?: string }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();

    if (!file) return { success: false, error: 'File not found' };
    if (file.fileType !== 'payment_proof') return { success: false, error: 'Not a payment proof' };
    if (file.status !== 'pending') return { success: false, error: 'Already reviewed' };
    if (!file.relatedDebtId) return { success: false, error: 'No related debt found' };

    const debt = this.db.select().from(debts).where(eq(debts.id, file.relatedDebtId)).get();
    if (!debt) return { success: false, error: 'Related debt not found' };

    if (debt.creditorId !== reviewerId) {
      return { success: false, error: 'Only creditor can reject payment proofs' };
    }

    this.db
      .update(fileMetadata)
      .set({
        status: 'rejected' as FileStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason
      })
      .where(eq(fileMetadata.id, fileId))
      .run();

    log.debug('FILE', 'Proof rejected', { fileId, reviewerId, reason });
    return {
      success: true,
      debtId: file.relatedDebtId,
      uploaderId: file.uploadedById
    };
  }

  async deleteFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();
    if (!file) return { success: false, error: 'File not found' };
    if (file.uploadedById !== userId) return { success: false, error: 'Not authorized' };

    const targetStorage =
      file.fileType === 'payment_proof' ? this.proofStorage : this.uploadStorage;
    await targetStorage.delete(file.storagePath);
    this.db.delete(fileMetadata).where(eq(fileMetadata.id, fileId)).run();
    await cache.del(`file:${fileId}`);

    log.debug('FILE', 'Deleted', { fileId });
    return { success: true };
  }
}
