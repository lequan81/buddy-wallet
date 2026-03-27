/**
 * Job Service Type Definitions
 */

/// <reference types="./import" />

export type JobType = 'preview' | 'import';

export interface JobPayload {
  file?: File;
  userId: string | { id: string; phoneNumber: string | null };
  fileName?: string;
  config?: {
    mapping: import('./import').ColumnMapping;
    startRow: number;
  };
  previewLogId?: string;
}
