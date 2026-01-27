/**
 * Import/Export Type Definitions
 */

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

export interface ImportPreviewResult {
  logId: string;
  columns: string[];
  preview: string[][];
  totalRows: number;
  autoMapping: Record<string, string>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}

export interface ImportRowError {
  row: number;
  message: string;
  data?: Record<string, unknown>;
}
