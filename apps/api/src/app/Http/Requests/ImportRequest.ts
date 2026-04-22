/**
 * Import/Export Request DTOs
 *
 * Validation schemas for import/export endpoints using Valibot.
 */

import * as v from 'valibot';
import {
  progressQuerySchema,
  progressBatchSchema,
  importLogsQuerySchema
} from '@repo/validation';

/**
 * Preview import request
 */
export const PreviewImportRequest = v.object({
  file: v.instance(File),
  sheetName: v.optional(v.string())
});

export type PreviewImportRequest = v.InferInput<typeof PreviewImportRequest>;

/**
 * Start import request
 */
export const StartImportRequest = v.object({
  file: v.instance(File),
  mapping: v.record(v.string(), v.string()),
  sheetName: v.optional(v.string())
});

export type StartImportRequest = v.InferInput<typeof StartImportRequest>;

/**
 * Import progress query
 */
export const ProgressQueryRequest = progressQuerySchema;
export type ProgressQueryRequest = v.InferInput<typeof ProgressQueryRequest>;

/**
 * Progress batch body
 */
export const ProgressBatchRequest = progressBatchSchema;
export type ProgressBatchRequest = v.InferInput<typeof ProgressBatchRequest>;

/**
 * Logs query parameters
 */
export const LogsQueryRequest = importLogsQuerySchema;
export type LogsQueryRequest = v.InferInput<typeof LogsQueryRequest>;

