export interface ColumnMapping {
  name: string;
  amount: string;
  phone?: string;
  email?: string;
  description?: string;
  dueDate?: string;
}

export interface ImportConfig {
  mapping: ColumnMapping;
  startRow: number;
}

export interface PreviewResult {
  success: boolean;
  error?: string;
  logId?: string;
  fileName?: string;
  totalRows?: number;
  columnHeaders?: string[];
  previewData?: string[][];
  autoMapping?: Record<string, string>;
}

export interface ImportResult {
  success: boolean;
  error?: string;
  logId?: string;
  imported?: number;
  errors?: string[];
}

export interface ProgressResult {
  success: boolean;
  error?: string;
  current?: number;
  total?: number;
  status?: string;
  errors?: string[];
  percentage?: number;
  result?: PreviewResult | ImportResult;
  message?: string;
}

export interface ImportJob {
  jobId: string;
  type: string;
  fileName: string;
  status: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  result?: PreviewResult | ImportResult;
  error?: string;
  message?: string;
}

export interface ImportLog {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  status: string;
  totalRows: number;
  importedCount: number;
  errorCount: number;
  errors?: string[];
  createdAt: string | Date;
  completedAt?: string | Date;
  previewLogId?: string;
  previewData?: string[][];
  columnHeaders?: string[];
  columnMapping?: Record<string, string>;
  startRow?: number;
}

export interface ImportDetailResult {
  importedDebts: Array<{
    id: string;
    description: string;
    amount: number;
    debtorName?: string;
    creditorName?: string;
  }>;
  skippedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
}
