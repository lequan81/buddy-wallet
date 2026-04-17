import { injectable } from 'tsyringe';
import { db, fileMetadata, eq, and, sql } from '@repo/db';
import type { FileMetadata, FileStatus } from '@repo/db';
import type { FileRepositoryInterface } from '../Contracts/FileRepositoryInterface';

@injectable()
export class FileRepository implements FileRepositoryInterface {
  async create(data: Omit<FileMetadata, 'createdAt'>): Promise<FileMetadata> {
    const [result] = await db.insert(fileMetadata).values(data).returning();
    return result;
  }

  async findById(id: string): Promise<FileMetadata | null> {
    const result = await db.query.fileMetadata.findFirst({
      where: (files, { eq }) => eq(files.id, id)
    });
    return result || null;
  }

  async findByUserIdAndType(userId: string, type: string): Promise<FileMetadata[]> {
    return db.query.fileMetadata.findMany({
      where: (files, { and, eq }) => and(eq(files.userId, userId), eq(files.type, type))
    });
  }

  async findByDebtIdAndType(debtId: string, type: string, status?: FileStatus): Promise<FileMetadata[]> {
    const conditions = [eq(fileMetadata.debtId, debtId), eq(fileMetadata.type, type)];
    if (status) {
      conditions.push(eq(fileMetadata.status, status));
    }
    return db.query.fileMetadata.findMany({
      where: and(...conditions)
    });
  }

  async updateStatus(id: string, status: FileStatus, reviewerId: string, reason?: string): Promise<void> {
    await db.update(fileMetadata)
      .set({ 
        status, 
        reviewedById: reviewerId, 
        reviewedAt: new Date(),
        rejectionReason: reason || null
      })
      .where(eq(fileMetadata.id, id));
  }

  async deleteById(id: string): Promise<void> {
    await db.delete(fileMetadata).where(eq(fileMetadata.id, id));
  }
}
