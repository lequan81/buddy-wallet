import type { User, Debt, ImportLog } from '@repo/db';

export interface IImportExportRepository {
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
  getLogsPaginated(userId: string, limit: number, offset: number): Promise<{ logs: ImportLog[]; total: number }>;
  deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number>;
  findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]>;
  createDebtsBatch(debtsToCreate: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void>;
}
