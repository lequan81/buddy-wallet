import type { User, ImportLog, Debt } from '@repo/db';
import type { PaginatedResult } from '@repo/types';

export interface ImportRepositoryInterface {
  createLog(data: {
    id: string;
    userId: string;
    fileName: string;
    fileSize: number;
    status: 'pending' | 'processing' | 'success' | 'failed' | 'preview';
    previewLogId: string | null;
    totalRows: number | null;
    importedCount: number | null;
    errorCount: number | null;
    errors: string | null;
    config: string | null;
    completedAt: Date | null;
  }): Promise<void>;

  updateLog(id: string, data: Partial<ImportLog>): Promise<void>;

  getLogById(id: string, userId: string): Promise<ImportLog | null>;

  getLogsByIds(ids: string[], userId: string): Promise<ImportLog[]>;

  getLogsPaginated(userId: string, limit: number, offset: number): Promise<PaginatedResult<ImportLog>>;

  deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number>;

  findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]>;

  createDebtsBatch(debtsToCreate: any[]): Promise<void>;
}
