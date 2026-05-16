import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';
import type { ListQuery } from '@/types/common-queries';



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

export type ExportDataContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ExportDataQuery>;
export type ImportDataContext = AuthenticatedHandlerContext<ImportDataBody>;
export type ImportLogsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ImportLogsQuery>;
export type ImportProgressContext = AuthenticatedHandlerContext<unknown, ImportIdParams>;
export type ImportRemapContext = AuthenticatedHandlerContext<RemapBody, ImportIdParams>;
export type PreviewHandlerContext = AuthenticatedHandlerContext<PreviewBody>;
export type ImportFromPreviewContext = AuthenticatedHandlerContext<StartFromPreviewBody, ImportIdParams>;
