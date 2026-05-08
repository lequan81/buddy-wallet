import { randomUUIDv7 } from 'bun';
import { db } from '@/providers/database';
import type { DbClient } from '@repo/db';

/**
 * File Repository (stub)
 *
 * The file_metadata table has been removed. File metadata is no longer
 * tracked in the database — files are managed directly via the storage provider.
 *
 * This stub is kept temporarily to avoid breaking imports. It should be
 * removed once all callers are updated.
 * @deprecated Remove this file and update all callers.
 */
export class FileRepository {
  constructor(private readonly database: DbClient = db) {}

  async createUpload(data: {
    uploadedById: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    return {
      id: randomUUIDv7(),
      uploadedById: data.uploadedById,
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      createdAt: new Date()
    };
  }

  async findByStoragePathAndUser(_storagePath: string, _userId: string) {
    return null;
  }

  async findByUserIdPaginated(
    _userId: string,
    _limit: number,
    _offset: number
  ) {
    return { data: [], total: 0 };
  }

  async findById(_id: string) {
    return null;
  }

  async deleteByStoragePathAndUser(_storagePath: string, _userId: string) {
    return true;
  }
}
