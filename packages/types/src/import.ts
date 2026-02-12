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
}
