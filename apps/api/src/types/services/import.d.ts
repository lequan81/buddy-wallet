/**
 * Import/Export Type Definitions
 */
import type { debts } from '@repo/db';

export type {
  ColumnMapping,
  ImportConfig,
  PreviewResult,
  ImportResult,
  ProgressResult
} from '@repo/types';

/**
 * Type for a single debt row being imported
 * Matches the database insertion schema
 */
export type ImportRow = typeof debts.$inferInsert;

/**
 * Mapping detected from spreadsheet headers
 */
export interface DetectedMapping {
  [key: string]: string;
  name: string;
  amount: string;
  phone: string;
  email: string;
  description: string;
  dueDate: string;
}
