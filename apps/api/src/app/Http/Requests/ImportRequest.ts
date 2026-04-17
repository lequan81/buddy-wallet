/**
 * Import/Export Request DTOs
 *
 * Validation schemas for import/export endpoints.
 */

import { z } from 'zod';

/**
 * Preview import request
 */
export const PreviewImportRequest = z.object({
  file: z.instanceof(File),
  sheetName: z.string().optional()
});

export type PreviewImportRequest = z.infer<typeof PreviewImportRequest>;

/**
 * Start import request
 */
export const StartImportRequest = z.object({
  file: z.instanceof(File),
  mapping: z.record(z.string(), z.string()),
  sheetName: z.string().optional()
});

export type StartImportRequest = z.infer<typeof StartImportRequest>;

/**
 * Import progress query
 */
export const ProgressQueryRequest = z.object({
  logId: z.string(),
  timeout: z.number().int().positive().default(30000)
});

export type ProgressQueryRequest = z.infer<typeof ProgressQueryRequest>;

/**
 * Progress batch body
 */
export const ProgressBatchRequest = z.object({
  logId: z.string(),
  batchSize: z.number().int().positive().default(50)
});

export type ProgressBatchRequest = z.infer<typeof ProgressBatchRequest>;

/**
 * Logs query parameters
 */
export const LogsQueryRequest = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(10),
  status: z.enum(['pending', 'processing', 'success', 'failed']).optional()
});

export type LogsQueryRequest = z.infer<typeof LogsQueryRequest>;
