import * as v from 'valibot';

export const workerEnvSchema = v.object({
  NODE_ENV: v.union([v.literal('development'), v.literal('staging'), v.literal('production')]),
  DATABASE_URL: v.string(),
  REDIS_URL: v.optional(v.string()),
  IMPORT_CHUNK_SIZE: v.optional(v.pipe(v.string(), v.regex(/^\d+$/))),
  IMPORT_MAX_ROWS: v.optional(v.pipe(v.string(), v.regex(/^\d+$/))),
});

export type WorkerEnv = v.InferOutput<typeof workerEnvSchema>;
