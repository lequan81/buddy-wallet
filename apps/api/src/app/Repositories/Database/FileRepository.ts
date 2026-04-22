import { injectable, inject } from 'tsyringe';
import { fileMetadata, eq, and, sql, type DbClient, type FileMetadata, type FileStatus } from '@repo/db';
import type { FileRepositoryInterface } from '../Contracts/FileRepositoryInterface';

@injectable()
export class FileRepository implements FileRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async create(data: Omit<FileMetadata, 'createdAt'>): Promise<FileMetadata> {
    const [result] = await this.db.insert(fileMetadata).values(data as any).returning();
    return result as FileMetadata;
  }

  async findById(id: string): Promise<FileMetadata | null> {
    const result = await this.db.query.fileMetadata.findFirst({
      where: (files: any, { eq }: any) => eq(files.id, id)
    });
    return (result as FileMetadata) || null;
  }

  async findByUserIdAndType(userId: string, type: string): Promise<FileMetadata[]> {
    return (await this.db.query.fileMetadata.findMany({
      where: (files: any, { and, eq }: any) =>
        and(eq(files.uploadedById, userId), eq(files.fileType, type))
    })) as FileMetadata[];
  }

  async findByDebtIdAndType(debtId: string, type: string, status?: FileStatus): Promise<FileMetadata[]> {
    const conditions = [eq(fileMetadata.relatedDebtId, debtId), eq(fileMetadata.fileType, type)];
    if (status) {
      conditions.push(eq(fileMetadata.status, status));
    }
    return (await this.db.query.fileMetadata.findMany({
      where: and(...conditions)
    })) as FileMetadata[];
  }

  async updateStatus(id: string, status: FileStatus, reviewerId: string, reason?: string): Promise<void> {
    await this.db.update(fileMetadata)
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
