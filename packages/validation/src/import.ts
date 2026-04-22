import * as v from 'valibot';

/**
 * Import Status Picklist
 */
export const importStatusSchema = v.picklist(['pending', 'processing', 'success', 'failed'] as const);
export type ImportStatus = v.InferInput<typeof importStatusSchema>;

/**
 * Import Progress Query Request
 */
export const progressQuerySchema = v.strictObject({
  logId: v.string(),
  timeout: v.pipe(v.optional(v.number(), 30000), v.minValue(1))
});

/**
 * Import Progress Batch Request
 */
export const progressBatchSchema = v.strictObject({
  logId: v.string(),
  batchSize: v.pipe(v.optional(v.number(), 50), v.minValue(1))
});

/**
 * Import Logs Query Request
 */
export const importLogsQuerySchema = v.strictObject({
  page: v.pipe(v.optional(v.number(), 1), v.minValue(1)),
  limit: v.pipe(v.optional(v.number(), 10), v.minValue(1), v.maxValue(50)),
  status: v.optional(importStatusSchema)
});

export type ProgressQueryInput = v.InferInput<typeof progressQuerySchema>;
export type ProgressBatchInput = v.InferInput<typeof progressBatchSchema>;
export type ImportLogsQueryInput = v.InferInput<typeof importLogsQuerySchema>;
