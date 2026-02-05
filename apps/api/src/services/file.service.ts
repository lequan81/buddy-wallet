/**
 * File Service
 *
 * Handles file upload, processing, storage, and retrieval.
 * - Processes images: strips EXIF, converts to WebP at 82% quality
 * - Stores files on filesystem, metadata in SQLite
 * - Caches frequently accessed files in Redis
 */
import sharp from 'sharp';
import { unlink } from 'node:fs/promises';
import { fileMetadata, debts, eq, and } from '@repo/db';
import { cache } from '@plugins/redis';
import { log } from '@utils/logger';
import type { DbClient } from '@/types';
import type { FileType, FileStatus, FileMetadata } from '@repo/db';

// Configuration
const UPLOAD_DIR = Bun.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(Bun.env.MAX_FILE_SIZE_MB || '4') * 1024 * 1024;
const WEBP_QUALITY = 82;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
];
const IMAGE_CACHE_TTL = 3600; // 1 hour

// Magic bytes for image format validation (prevents MIME spoofing)
const MAGIC_BYTES: Record<string, number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47], // \x89PNG
  gif: [0x47, 0x49, 0x46], // GIF
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
  // HEIC/HEIF - starts with ftyp box
  heic: [0x00, 0x00, 0x00] // First 3 bytes of ftyp box (size varies)
};

/**
 * Validate file content using magic bytes (not just MIME header)
 */
function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // Check standard formats
  for (const [format, bytes] of Object.entries(MAGIC_BYTES)) {
    if (format === 'heic') continue; // Special handling below
    if (bytes.every((b, i) => buffer[i] === b)) return true;
  }

  // HEIC/HEIF check: look for 'ftyp' marker and heic/heif/mif1 brand
  // Format: [size(4)] [ftyp(4)] [brand(4)]
  const ftypMarker = buffer.slice(4, 8).toString('ascii');
  if (ftypMarker === 'ftyp') {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (['heic', 'heif', 'mif1', 'heix'].includes(brand)) return true;
  }

  return false;
}

// Ensure upload directories exist
async function ensureUploadDirs() {
  await Bun.write(`${UPLOAD_DIR}/qr/.gitkeep`, '');
  await Bun.write(`${UPLOAD_DIR}/proofs/.gitkeep`, '');
}
ensureUploadDirs();

/**
 * Process image: strip metadata, convert to WebP
 */
async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .webp({ quality: WEBP_QUALITY }) // Convert to WebP, strips all metadata
    .toBuffer();
}

/**
 * Validate file before processing
 */
function validateFile(
  file: File,
  buffer: Buffer
): { valid: true } | { valid: false; error: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }

  // Validate actual file content (magic bytes)
  if (!isValidImageMagicBytes(buffer)) {
    return { valid: false, error: 'Invalid image format - file content does not match image type' };
  }

  return { valid: true };
}

export class FileService {
  constructor(private db: DbClient) { }

  /**
   * Upload and process a file
   */
  async uploadFile(
    file: File,
    userId: string,
    type: FileType,
    relatedDebtId?: string
  ): Promise<{
    success: boolean;
    error?: string;
    file?: FileMetadata;
  }> {
    try {
      // Read buffer first for magic bytes validation
      const buffer = Buffer.from(await file.arrayBuffer());

      // Validate (size, MIME, magic bytes)
      const validation = validateFile(file, buffer);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Process image
      const processedBuffer = await processImage(buffer);

      // Generate unique filename using Bun's built-in UUID v7 (time-sortable)
      const id = Bun.randomUUIDv7();
      const filename = `${id}.webp`;
      const subdir = type === 'qr_code' ? 'qr' : 'proofs';
      const storagePath = `${subdir}/${filename}`;
      const fullPath = `${UPLOAD_DIR}/${storagePath}`;

      // Save to disk
      await Bun.write(fullPath, processedBuffer);

      // Save metadata to DB
      const now = new Date();
      const metadata: typeof fileMetadata.$inferInsert = {
        id,
        filename,
        originalName: file.name,
        mimeType: 'image/webp',
        sizeBytes: processedBuffer.length,
        storagePath,
        uploadedById: userId,
        fileType: type,
        relatedDebtId,
        status: type === 'qr_code' ? 'approved' : 'pending', // QR codes auto-approved
        createdAt: now
      };

      try {
        this.db.insert(fileMetadata).values(metadata).run();
      } catch (dbError) {
        // Cleanup file if DB insert fails
        try {
          await unlink(fullPath);
        } catch {
          // Ignore unlink error
        }
        throw dbError; // Re-throw to be caught by outer catch
      }

      log.debug('FILE', 'Uploaded', { id, type, size: processedBuffer.length });

      return {
        success: true,
        file: metadata as FileMetadata
      };
    } catch (err) {
      log.error('FILE', 'Upload failed', { error: String(err) });
      return { success: false, error: 'Failed to process file' };
    }
  }

  /**
   * Get file by ID (with Redis caching)
   */
  async getFile(fileId: string): Promise<{
    success: boolean;
    error?: string;
    data?: Buffer;
    mimeType?: string;
    metadata?: FileMetadata;
  }> {
    // Get metadata
    const metadata = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();

    if (!metadata) {
      return { success: false, error: 'File not found' };
    }

    // Check Redis cache first
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

    // Read from disk
    const fullPath = `${UPLOAD_DIR}/${metadata.storagePath}`;
    const file = Bun.file(fullPath);

    if (!(await file.exists())) {
      return { success: false, error: 'File not found on disk' };
    }

    const data = Buffer.from(await file.arrayBuffer());

    // Cache in Redis
    await cache.set(cacheKey, data.toString('base64'), IMAGE_CACHE_TTL);

    return {
      success: true,
      data,
      mimeType: metadata.mimeType,
      metadata
    };
  }

  /**
   * Get user's QR codes
   */
  async getUserQRCodes(userId: string): Promise<FileMetadata[]> {
    return this.db
      .select()
      .from(fileMetadata)
      .where(and(eq(fileMetadata.uploadedById, userId), eq(fileMetadata.fileType, 'qr_code')))
      .all();
  }

  /**
   * Get pending payment proofs for a debt (for creditor to review)
   */
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

  /**
   * Approve a payment proof (only creditor can approve)
   */
  async approveProof(
    fileId: string,
    reviewerId: string,
    reviewerPhone?: string // DEPRECATED: No longer used for authorization
  ): Promise<{ success: boolean; error?: string }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();

    if (!file) {
      return { success: false, error: 'File not found' };
    }

    if (file.fileType !== 'payment_proof') {
      return { success: false, error: 'Not a payment proof' };
    }

    if (file.status !== 'pending') {
      return { success: false, error: 'Already reviewed' };
    }

    // Verify reviewer is the creditor of related debt
    if (!file.relatedDebtId) {
      return { success: false, error: 'No related debt found' };
    }

    const debt = this.db.select().from(debts).where(eq(debts.id, file.relatedDebtId)).get();
    if (!debt) {
      return { success: false, error: 'Related debt not found' };
    }

    // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
    const isCreditor = debt.creditorId === reviewerId;
    if (!isCreditor) {
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

  /**
   * Reject a payment proof (only creditor can reject)
   */
  async rejectProof(
    fileId: string,
    reviewerId: string,
    reviewerPhone?: string, // DEPRECATED: No longer used for authorization
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();

    if (!file) {
      return { success: false, error: 'File not found' };
    }

    if (file.fileType !== 'payment_proof') {
      return { success: false, error: 'Not a payment proof' };
    }

    if (file.status !== 'pending') {
      return { success: false, error: 'Already reviewed' };
    }

    // Verify reviewer is the creditor of related debt
    if (!file.relatedDebtId) {
      return { success: false, error: 'No related debt found' };
    }

    const debt = this.db.select().from(debts).where(eq(debts.id, file.relatedDebtId)).get();
    if (!debt) {
      return { success: false, error: 'Related debt not found' };
    }

    // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
    const isCreditor = debt.creditorId === reviewerId;
    if (!isCreditor) {
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

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const file = this.db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).get();

    if (!file) {
      return { success: false, error: 'File not found' };
    }

    // Only owner can delete
    if (file.uploadedById !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    // Delete from disk using proper fs.unlink
    const fullPath = `${UPLOAD_DIR}/${file.storagePath}`;
    try {
      await unlink(fullPath);
    } catch {
      // File might not exist, continue
    }

    // Delete from DB
    this.db.delete(fileMetadata).where(eq(fileMetadata.id, fileId)).run();

    // Clear cache
    await cache.del(`file:${fileId}`);

    log.debug('FILE', 'Deleted', { fileId });
    return { success: true };
  }
}
