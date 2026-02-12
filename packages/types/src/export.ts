export type ExportFormat = 'xlsx' | 'csv';

export interface ExportResult {
  success: boolean;
  error?: string;
  buffer?: Buffer;
  contentType?: string;
  filename?: string;
}
