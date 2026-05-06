import { randomUUIDv7 } from 'bun';
import { fileMetadata, eq, and, count as sqlCount, desc } from '@repo/db';
import type { FileMetadata, DbClient } from '@repo/db';
import { db } from '@/providers/database';

/**
 * File Repository
 * Data access layer for file metadata lifecycle.
 */
export class FileRepository {
  constructor(private readonly database: DbClient = db) {}

  async createUpload(data: {
    uploadedById: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<FileMetadata> {
    const [result] = await this.database
      .insert(fileMetadata)
      .values({
        id: randomUUIDv7(),
        uploadedById: data.uploadedById,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        createdAt: new Date()
      })
      .returning();

    return result as FileMetadata;
  }

  async findByStoragePathAndUser(storagePath: string, userId: string): Promise<FileMetadata | null> {
    const result = await this.database
      .select()
      .from(fileMetadata)
      .where(and(eq(fileMetadata.storagePath, storagePath), eq(fileMetadata.uploadedById, userId)))
      .get();
    return (result as FileMetadata) || null;
  }

  async findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ data: FileMetadata[]; total: number }> {
    const [data, countResult] = await Promise.all([
      this.database
        .select()
        .from(fileMetadata)
        .where(eq(fileMetadata.uploadedById, userId))
        .orderBy(desc(fileMetadata.createdAt))
        .limit(limit)
        .offset(offset)
        .all(),
      this.database
        .select({ count: sqlCount() })
        .from(fileMetadata)
        .where(eq(fileMetadata.uploadedById, userId))
        .get()
    ]);

    return {
      data: data as FileMetadata[],
      total: Number(countResult?.count ?? 0)
    };
  }

  async findById(id: string): Promise<FileMetadata | null> {
    const result = await this.database.select().from(fileMetadata).where(eq(fileMetadata.id, id)).get();
    return (result as FileMetadata) || null;
  }

  async deleteByStoragePathAndUser(storagePath: string, userId: string): Promise<boolean> {
    const deleted = await this.database
      .delete(fileMetadata)
      .where(and(eq(fileMetadata.storagePath, storagePath), eq(fileMetadata.uploadedById, userId)))
      .returning({ id: fileMetadata.id });

    return deleted.length > 0;
  }
}
