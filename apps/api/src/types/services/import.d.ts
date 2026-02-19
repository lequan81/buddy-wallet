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

export type DetectedMapping = Record<string, string>;

export interface CurrentUser {
  id: string;
  phoneNumber: string | null;
}

export interface ImportRow {
  id: string;
  debtorId: string | null;
  creditorId: string;
  debtorPhone: string;
  creditorPhone: string;
  amount: number;
  description: string;
  status: string;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreviewResult {
  success: boolean;
  error?: string;
  logId?: string;
  fileName?: string;
  totalRows?: number;
  columnHeaders?: string[];
  previewData?: string[][];
  autoMapping?: DetectedMapping;
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
  result?: unknown;
}
