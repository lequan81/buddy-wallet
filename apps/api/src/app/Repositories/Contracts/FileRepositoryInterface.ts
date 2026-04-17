import type { FileMetadata, FileStatus } from '@repo/db';

export interface FileRepositoryInterface {
  create(data: Omit<FileMetadata, 'createdAt'>): Promise<FileMetadata>;
  findById(id: string): Promise<FileMetadata | null>;
  findByUserIdAndType(userId: string, type: string): Promise<FileMetadata[]>;
  findByDebtIdAndType(debtId: string, type: string, status?: FileStatus): Promise<FileMetadata[]>;
  updateStatus(id: string, status: FileStatus, reviewerId: string, reason?: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}
