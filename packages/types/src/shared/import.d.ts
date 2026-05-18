import type { Result } from '../api/base';
import type { ImportState } from './workflow';
import type { JobStatus } from '../worker/jobs';

/**
 * CSV/Spreadsheet Column Mapping
 */
export interface ColumnMapping {
  name: string;
  amount: string;
  phone?: string;
  email?: string;
  description?: string;
  dueDate?: string;
  [key: string]: string | undefined;
}

export interface ImportConfig {
  mapping: ColumnMapping;
  startRow: number;
}

export type ImportLogStatus = ImportState;

export interface ImportLog {
  id: string;
  userId: string | null;
  fileName: string;
  fileSize: number;
  status: ImportLogStatus;
  previewLogId: string | null;
  totalRows: number | null;
  importedCount: number | null;
  errorCount: number | null;
  errors: string | null;
  config: string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
  deletedAt: Date | string | null;
  // Additional properties returned by getLogById API
  previewData?: string[][];
  columnHeaders?: string[];
  columnMapping?: Record<string, string>;
  startRow?: number;
  totalRowsCached?: number;
}

export interface ImportDetailResult {
  importedDebts: Array<{
    id: string;
    amount: number;
    description: string | null;
    debtorName?: string | null;
    creditorName?: string | null;
  }>;
  skippedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
}

export interface ImportProgress {
  status: JobStatus;
  current: number;
  total: number;
  percentage: number;
  message?: string;
  errors?: string[];
  result?: PreviewResultData | ImportResultData;
}

/**
 * Preview result data payload (success case)
 */
export interface PreviewResultData {
  logId: string;
  fileName: string;
  totalRows: number;
  columnHeaders: string[];
  previewData: string[][];
  autoMapping: Record<string, string>;
}

/**
 * Import result data payload (success case)
 */
export interface ImportResultData {
  jobId: string;
  logId: string;
  imported: number;
  errors: string[];
}

/**
 * Result types for import/preview operations
 * These are returned from import.job.ts (worker)
 */
export type PreviewResult = Result<PreviewResultData>;

export type ImportResult = Result<ImportResultData>;

export type ProgressResult = Result<ImportProgress>;
