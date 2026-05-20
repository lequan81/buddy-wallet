import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import type { EntityIdParams } from '@repo/types/api/common-params';
import type { ListQuery } from '@repo/types/api/common-queries';

// ── Export / Import Enums ────────────────────────────────────────────

export type ExportType = 'debts' | 'users' | 'bank-accounts';
export type ExportFormat = 'json' | 'csv';

export interface ExportDataQuery {
  type: ExportType;
  format?: ExportFormat;
  startDate?: string;
  endDate?: string;
}

export interface ImportDataBody {
  type: ExportType;
  format: ExportFormat;
  data: unknown;
}

export type ImportLogsQuery = ListQuery;
export type ImportIdParams = EntityIdParams;

export interface RemapBody {
  columnMapping?: Record<string, string>;
}

export interface PreviewBody {
  file: File;
}

export interface StartFromPreviewBody {
  columnMapping: Record<string, string>;
  startRow?: number;
}

// ── Handler Context Aliases ──────────────────────────────────────────

export type ExportDataContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ExportDataQuery>;
export type ImportDataContext = AuthenticatedHandlerContext<ImportDataBody>;
export type ImportLogsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ImportLogsQuery>;
export type ImportProgressContext = AuthenticatedHandlerContext<unknown, ImportIdParams>;
export type ImportRemapContext = AuthenticatedHandlerContext<RemapBody, ImportIdParams>;
export type PreviewHandlerContext = AuthenticatedHandlerContext<PreviewBody>;
export type ImportFromPreviewContext = AuthenticatedHandlerContext<StartFromPreviewBody, ImportIdParams>;

// ── Import Preview Domain Types (canonical home) ─────────────────────
// Previously scattered across preview.handler.ts and import-preview.service.ts

/** Parsed spreadsheet data — output of the file parsing step */
export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  fileName: string;
}

/** Preview result returned after worker parses an uploaded file */
export interface PreviewResult {
  previewId: string;
  headers: string[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
  suggestedMapping: Record<string, string>;
  fileName: string;
}

/** Validation result for a batch of mapped debt rows */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  validRowCount: number;
  totalRowCount: number;
}

/** Column mapping: dbField → spreadsheet header */
export interface ColumnMapping {
  [dbField: string]: string;
}

/** Discriminated result type for spreadsheet parsing */
export type ParseResult =
  | { kind: 'success'; data: ParsedSpreadsheet }
  | { kind: 'error'; code: string; message: string };

/** Preview data cached in Redis / S3 for the GET /preview-data endpoint */
export interface ImportPreviewData {
  columnHeaders: string[];
  previewRows: string[][];
  previewData: string[][];
  autoMapping: Record<string, string>;
  totalRows: number;
  fileName: string;
}

