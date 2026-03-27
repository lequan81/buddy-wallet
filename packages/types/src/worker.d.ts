/**
 * Worker Job Types
 *
 * Shared between the import worker and JobsService.
 */

export interface ColumnMapping {
  name: string;
  amount: string;
  phone?: string;
  email?: string;
  description?: string;
  dueDate?: string;
}

export interface WorkerJobPayload {
  type: 'preview' | 'import';
  jobId: string;
  userId: string | { id: string; phoneNumber?: string | null };
  fileName: string;
  tempFilePath?: string;
  config?: {
    mapping: ColumnMapping;
    startRow: number;
  };
  previewLogId?: string;
}

export interface ImportProgress {
  status: 'pending' | 'processing' | 'success' | 'failed';
  current: number;
  total: number;
  message?: string;
  errors?: string[];
  result?: {
    imported: number;
    errors?: string[];
  };
}
