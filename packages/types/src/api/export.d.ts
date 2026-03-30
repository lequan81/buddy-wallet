import type { BaseResult } from './base';

/**
 * Export Types
 */
export interface ExportResult extends BaseResult {
  url?: string;
  fileName?: string;
}
