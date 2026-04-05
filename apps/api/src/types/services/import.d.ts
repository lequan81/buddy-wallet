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

/** Cache for resolved user lookups during import */
export type ImportUserCache = Map<string, { id: string; phone: string | null }>;

/** Internal state during row processing */
export type ImportRowProcessingState = {
  errors: string[];
  newDebts: ImportRow[];
  userCache: ImportUserCache;
  dataStartIndex: number;
  totalRowsToProcess: number;
};

/** Result of building preview data from spreadsheet */
export type PreviewBuildResult = {
  columnHeaders: string[];
  previewData: string[][];
  autoMapping: Record<string, string>;
};

/** Result of validating import file upload */
export type ValidationFailure = {
  status: number;
  body: ReturnType<typeof import('@repo/errors').errorResponse>;
};
