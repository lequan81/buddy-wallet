import type { JobState } from '../shared/workflow';
import type { ColumnMapping, ImportResult, PreviewResult } from '../shared/import';

export type JobStatus = JobState;
export type JobType =
  | 'import'
  | 'preview'
  | 'export'
  | 'notification'
  | 'cleanup'
  | 'sync'
  | 'image_processing';
export type ImportJobType = 'import' | 'preview';

export interface JobPayload {
  userId: string | { id: string };
  file?: File;
  fileName?: string;
  config?: {
    mapping: ColumnMapping;
    startRow: number;
  };
  previewLogId?: string;
}

export interface WorkerJobPayload {
  type: JobType;
  jobId: string;
  userId: string | { id: string };
  fileName: string;
  config?: {
    mapping?: ColumnMapping;
    startRow?: number;
    [key: string]: unknown;
  };
  previewLogId?: string;
  storageKey?: string;
  imageType?: 'avatar' | 'proof';
}

export interface BaseJob {
  id: string;
  jobId?: string; // Some parts use jobId, some use id
  type: JobType;
  status: JobStatus;
  progress: number | { current: number; total: number; percentage: number };
  userId: string;
  fileName?: string; // Add fileName to top level for easy access
  metadata?: Record<string, unknown> | null;
  result?: PreviewResult | ImportResult;
  error?: string | null;
  message?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
}

export interface ImportJob extends BaseJob {
  type: ImportJobType;
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
