import { type FileMetadata, type FileType } from '@repo/db';
import { cache, rawCache } from '@/plugins/redis';
import { log } from '@repo/logger';
import { MAX_IMAGE_FILE_SIZE, ACCEPTED_IMAGE_MIME_TYPES, BACKEND_CONSTANTS } from '@repo/config';
import { isValidImageBytes } from '@repo/utils';
import { createStorageServices } from './storage.service';
import type { IStorageService } from '@/types';
import type { IFileRepository, IDebtRepository } from '@/types/repositories';
import { ImageService } from './image.service';

const IMAGE_CACHE_TTL_SECONDS = Math.floor(BACKEND_CONSTANTS.CACHE.LOCATION_TTL_MS / 1000);

export class FileService {
  private uploadStorage: IStorageService;
  private proofStorage: IStorageService;
  private imageService: ImageService;

  constructor(
    private readonly fileRepo: IFileRepository,
    private readonly debtRepo: IDebtRepository,
    uploadStorage?: IStorageService,
    proofStorage?: IStorageService,
    imageService?: ImageService
  ) {
    const defaultStorage = createStorageServices();
    this.uploadStorage = uploadStorage || defaultStorage.uploadStorage;
    this.proofStorage = proofStorage || defaultStorage.proofStorage;
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
      const storedPath = await targetStorage.save(relativePath, processedBuffer);

      // Metadata
      const now = new Date();
      const status = (type === 'qr_code' ? 'approved' : 'pending') as string;

      const metadata = {
        id,
        filename,
        originalName: file.name,
        mimeType: 'image/webp',
        sizeBytes: processedBuffer.length,
        storagePath: storedPath,
        uploadedById: userId,
        fileType: type,
        relatedDebtId: relatedDebtId || null,
        status,
        createdAt: now,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null
      };

      try {
        await this.fileRepo.create(metadata);

        // Update debt proof tracking if this is a payment proof
        if (type === 'payment_proof' && relatedDebtId) {
          const debt = await this.debtRepo.findById(relatedDebtId);
          if (debt) {
            await this.debtRepo.update(relatedDebtId, {
              hasPendingProof: true,
              proofCount: (debt.proofCount || 0) + 1,
              lastProofUploadedAt: now,
              updatedAt: now
            });
            log.debug('FILE', 'Updated debt proof tracking', { debtId: relatedDebtId });
          }
        }
      } catch (dbError) {
        const targetStorage = type === 'payment_proof' ? this.proofStorage : this.uploadStorage;
        await targetStorage.delete(storedPath);
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
    const metadata = await this.fileRepo.findById(fileId);
    if (!metadata) return { success: false, error: 'File not found' };

    // Ownership / relationship check
    if (!isAdmin && metadata.uploadedById !== requestingUserId) {
      if (metadata.relatedDebtId) {
        const debt = await this.debtRepo.findById(metadata.relatedDebtId);
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
    const cachedBuffer = await rawCache.getBuffer(cacheKey);
    if (cachedBuffer) {
      return {
        success: true,
        data: cachedBuffer,
        mimeType: metadata.mimeType,
        metadata
      };
    }

    try {
      // Use storage provider's read() method
      const targetStorage =
        metadata.fileType === 'payment_proof' ? this.proofStorage : this.uploadStorage;
      const data = await targetStorage.read(metadata.storagePath);
      await rawCache.setBuffer(cacheKey, data as Buffer, IMAGE_CACHE_TTL_SECONDS);

      return { success: true, data, mimeType: metadata.mimeType, metadata };
    } catch {
      return { success: false, error: 'File not found in storage' };
    }
  }

  async getUserQRCodes(userId: string): Promise<FileMetadata[]> {
    return this.fileRepo.findByUserIdAndType(userId, 'qr_code');
  }

  async getPendingProofs(debtId: string): Promise<FileMetadata[]> {
    return this.fileRepo.findByDebtIdAndType(debtId, 'payment_proof', 'pending');
  }

  async getProofsForDebt(debtId: string): Promise<FileMetadata[]> {
    return this.fileRepo.findByDebtIdAndType(debtId, 'payment_proof');
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
    const file = await this.fileRepo.findById(fileId);

    if (!file) return { success: false, error: 'File not found' };
    if (file.fileType !== 'payment_proof') return { success: false, error: 'Not a payment proof' };
    if (file.status !== 'pending') return { success: false, error: 'Already reviewed' };
    if (!file.relatedDebtId) return { success: false, error: 'No related debt found' };

    const debt = await this.debtRepo.findById(file.relatedDebtId);
    if (!debt) return { success: false, error: 'Related debt not found' };

    if (debt.creditorId !== reviewerId) {
      return { success: false, error: 'Only creditor can approve payment proofs' };
    }

    await this.fileRepo.updateStatus(fileId, 'approved', reviewerId);

    // Recalculate pending proofs for this debt
    const remainingPending = await this.fileRepo.findByDebtIdAndType(file.relatedDebtId, 'payment_proof', 'pending');

    // Check if all proofs are now approved (no pending left)
    const allProofsApproved = remainingPending.length === 0;

    // Clear hasPendingProof if no more pending proofs
    if (allProofsApproved) {
      await this.debtRepo.update(file.relatedDebtId, {
        hasPendingProof: false,
        updatedAt: new Date()
      });
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
    const file = await this.fileRepo.findById(fileId);

    if (!file) return { success: false, error: 'File not found' };
    if (file.fileType !== 'payment_proof') return { success: false, error: 'Not a payment proof' };
    if (file.status !== 'pending') return { success: false, error: 'Already reviewed' };
    if (!file.relatedDebtId) return { success: false, error: 'No related debt found' };

    const debt = await this.debtRepo.findById(file.relatedDebtId);
    if (!debt) return { success: false, error: 'Related debt not found' };

    if (debt.creditorId !== reviewerId) {
      return { success: false, error: 'Only creditor can reject payment proofs' };
    }

    await this.fileRepo.updateStatus(fileId, 'rejected', reviewerId, reason);

    log.debug('FILE', 'Proof rejected', { fileId, reviewerId, reason });
    return {
      success: true,
      debtId: file.relatedDebtId,
      uploaderId: file.uploadedById
    };
  }

  async deleteFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const file = await this.fileRepo.findById(fileId);
    if (!file) return { success: false, error: 'File not found' };
    if (file.uploadedById !== userId) return { success: false, error: 'Not authorized' };

    const targetStorage =
      file.fileType === 'payment_proof' ? this.proofStorage : this.uploadStorage;
    await targetStorage.delete(file.storagePath);
    await this.fileRepo.deleteById(fileId);
    await cache.del(`file:${fileId}`);

    log.debug('FILE', 'Deleted', { fileId });
    return { success: true };
  }
}
