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
  message?: string;
  errors?: string[];
  result?: unknown;
}
