/**
 * Job & Worker Types
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'success' | 'preview';
export type JobType = 'import' | 'export' | 'notification' | 'cleanup' | 'sync';

export interface JobPayload {
  userId: string | { id: string };
  file?: File;
  fileName?: string;
  config?: { mapping: import('../core/import').ColumnMapping; startRow: number };
  previewLogId?: string;
}

export interface WorkerJobPayload {
  type: JobType;
  jobId: string;
  userId: string | { id: string };
  fileName: string;
  config?: { mapping: import('../core/import').ColumnMapping; startRow: number };
  previewLogId?: string;
  storageKey?: string;
}

export interface BaseJob {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  userId: string;
  metadata?: Record<string, unknown> | null;
  error?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
}

export interface ImportJob extends BaseJob {
  type: 'import';
  metadata: {
    fileName: string;
    s3Key: string;
    totalRows: number;
    processedRows: number;
    successCount: number;
    errorCount: number;
    invalidRows?: Array<{ row: number; errors: string[] }>;
  };
}
