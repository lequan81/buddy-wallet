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

export interface ImportProgress {
  status: import('../infrastructure/jobs').JobStatus;
  current: number;
  total: number;
  percentage: number;
  message?: string;
  errors?: string[];
  result?: PreviewResult | ImportResult;
}

export interface PreviewResult {
  success: boolean;
  logId?: string;
  fileName?: string;
  totalRows?: number;
  columnHeaders?: string[];
  previewData?: string[][];
  autoMapping?: Record<string, string>;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  jobId?: string;
  logId?: string;
  imported?: number;
  importedCount?: number;
  errors?: string[];
  error?: string;
}

export interface ProgressResult extends ImportProgress {
  success: boolean;
  error?: string;
}
