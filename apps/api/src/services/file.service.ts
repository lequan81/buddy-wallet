import { fileMetadata, debts, eq, and } from '@repo/db';
import { cache } from '@plugins/redis';
import { log } from '@utils/logger';
import type { DbClient } from '@/types';
import type { FileType, FileStatus, FileMetadata } from '@repo/db';
import { DiskStorageService, type IStorageService } from './storage.service';
import { ImageService } from './image.service';

// Configuration
const UPLOAD_DIR = Bun.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(Bun.env.MAX_FILE_SIZE_MB || '4') * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
];
const IMAGE_CACHE_TTL = 3600; // 1 hour

// Magic bytes for validation
const MAGIC_BYTES: Record<string, number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46],
  heic: [0x00, 0x00, 0x00]
};

function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  for (const [format, bytes] of Object.entries(MAGIC_BYTES)) {
    if (format === 'heic') continue;
    if (bytes.every((b, i) => buffer[i] === b)) return true;
  }
  const ftypMarker = buffer.slice(4, 8).toString('ascii');
  if (ftypMarker === 'ftyp') {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (['heic', 'heif', 'mif1', 'heix'].includes(brand)) return true;
  }
  return false;
}

export class FileService {
  private storage: IStorageService;
  private imageService: ImageService;

  constructor(
    private db: DbClient,
    storage?: IStorageService,
    imageService?: ImageService
  ) {
    this.storage = storage || new DiskStorageService(UPLOAD_DIR);
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
      if (file.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        };
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return {
          success: false,
          error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
        };
      }
      if (!isValidImageMagicBytes(buffer)) {
        return { success: false, error: 'Invalid image format' };
      }

      // Process
      const processedBuffer = await this.imageService.process(buffer);

      // Save
      const id = Bun.randomUUIDv7();
      const filename = `${id}.webp`;
      const subdir = type === 'qr_code' ? 'qr' : 'proofs';
      const relativePath = `${subdir}/${filename}`;

      await this.storage.save(relativePath, processedBuffer);

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
      } catch (dbError) {
        await this.storage.delete(relativePath);
        throw dbError;
      }

      log.debug('FILE', 'Uploaded', { id, type, size: processedBuffer.length });
      return { success: true, file: metadata as FileMetadata };
    } catch (err) {
      log.error('FILE', 'Upload failed', { error: String(err) });
      return { success: false, error: 'Failed to process file' };
    }
  }

  async getFile(fileId: string): Promise<{
    success: boolean;
    error?: string;
    data?: Buffer;
    mimeType?: string;
    metadata?: FileMetadata;
  }> {
    const metadata = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();
    if (!metadata) return { success: false, error: 'File not found' };

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
      // Use storage provider's read() method (no more type casting!)
      const data = await this.storage.read(metadata.storagePath);
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

  async approveProof(
    fileId: string,
    reviewerId: string
  ): Promise<{ success: boolean; error?: string }> {
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

    log.debug('FILE', 'Proof approved', { fileId, reviewerId });
    return { success: true };
  }

  async rejectProof(
    fileId: string,
    reviewerId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
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
    return { success: true };
  }

  async deleteFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();
    if (!file) return { success: false, error: 'File not found' };
    if (file.uploadedById !== userId) return { success: false, error: 'Not authorized' };

    await this.storage.delete(file.storagePath);
    this.db.delete(fileMetadata).where(eq(fileMetadata.id, fileId)).run();
    await cache.del(`file:${fileId}`);

    log.debug('FILE', 'Deleted', { fileId });
    return { success: true };
  }
}
