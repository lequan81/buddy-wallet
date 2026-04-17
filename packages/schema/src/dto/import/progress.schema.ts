import * as v from 'valibot';

export const progressSSEQuerySchema = v.object({
  logIds: v.optional(v.string())
});

export const progressBatchBodySchema = v.object({
  logIds: v.array(v.string())
});

export const logsQuerySchema = v.object({
  page: v.optional(v.string()),
  limit: v.optional(v.string())
});

export type ProgressSSEQuery = v.InferOutput<typeof progressSSEQuerySchema>;
export type ProgressBatchBody = v.InferOutput<typeof progressBatchBodySchema>;
export type LogsQuery = v.InferOutput<typeof logsQuerySchema>;
