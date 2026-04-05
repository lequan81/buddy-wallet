import type { BaseResult } from './base';

/**
 * Export Types
 */
export type ExportFormat = 'xlsx' | 'csv';

export interface ExportResult extends BaseResult {
  buffer?: Buffer;
  contentType?: string;
  filename?: string;
  url?: string;
  fileName?: string;
}
