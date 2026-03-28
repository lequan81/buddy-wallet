import { eq, and, desc } from 'drizzle-orm';
import type { FileMetadata, FileStatus } from '@repo/db';
import { fileMetadata } from '@repo/db';
import type { IFileRepository } from '@repo/types';
import type { DbClient } from '@/types';

export class DrizzleFileRepository implements IFileRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: Omit<FileMetadata, 'createdAt'>): Promise<FileMetadata> {
    const [row] = await this.db
      .insert(fileMetadata)
      .values({
        ...data,
        createdAt: new Date()
      })
      .returning();
    return row;
  }

  async findById(id: string): Promise<FileMetadata | null> {
    return (await this.db.select().from(fileMetadata).where(eq(fileMetadata.id, id)).get()) || null;
  }

  async findByUserIdAndType(userId: string, type: string): Promise<FileMetadata[]> {
    return this.db
      .select()
      .from(fileMetadata)
      .where(and(eq(fileMetadata.uploadedById, userId), eq(fileMetadata.fileType, type)))
      .all();
  }

  async findByDebtIdAndType(debtId: string, type: string, status?: FileStatus): Promise<FileMetadata[]> {
    const conditions = [
      eq(fileMetadata.relatedDebtId, debtId),
      eq(fileMetadata.fileType, type)
    ];
    if (status) {
      conditions.push(eq(fileMetadata.status, status));
    }
    return this.db
      .select()
      .from(fileMetadata)
      .where(and(...conditions))
      .orderBy(desc(fileMetadata.createdAt))
      .all();
  }

  async updateStatus(id: string, status: FileStatus, reviewerId: string, reason?: string): Promise<void> {
    await this.db
      .update(fileMetadata)
      .set({
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason || null
      })
      .where(eq(fileMetadata.id, id));
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(fileMetadata).where(eq(fileMetadata.id, id));
  }
}
