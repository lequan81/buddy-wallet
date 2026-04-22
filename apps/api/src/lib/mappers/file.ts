/**
 * File Mapper - Domain Transformations
 *
 * Handles transformation between Database FileMetadata entities and domain objects.
 */
import type { FileMetadata as FileMetadataEntity } from '@repo/db';

/**
 * Safe file metadata (excludes internal storage paths)
 */
export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  fileType: string;
  status: string;
  uploadedById: string;
  relatedDebtId: string | null;
  reviewedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/**
 * Map database file entity to safe domain object
 * Excludes storagePath for security
 */
export function toFileInfo(entity: FileMetadataEntity): FileInfo {
  return {
    id: entity.id,
    filename: entity.filename,
    originalName: entity.originalName,
    mimeType: entity.mimeType,
    sizeBytes: entity.sizeBytes,
    fileType: entity.fileType,
    status: entity.status,
    uploadedById: entity.uploadedById,
    relatedDebtId: entity.relatedDebtId,
    reviewedById: entity.reviewedById,
    rejectionReason: entity.rejectionReason,
    createdAt: entity.createdAt.toISOString(),
    reviewedAt: entity.reviewedAt?.toISOString() || null
  };
}

/**
 * Map multiple files to safe domain objects
 */
export function toFileInfoList(entities: FileMetadataEntity[]): FileInfo[] {
  return entities.map(toFileInfo);
}

/**
 * Map to admin view (includes storage path)
 * Only for authorized admin/debug use
 */
export function toFileAdminView(entity: FileMetadataEntity): FileInfo & { storagePath: string } {
  return {
    ...toFileInfo(entity),
    storagePath: entity.storagePath
  };
}
