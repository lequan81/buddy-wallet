import * as v from 'valibot';

const numberString = (label: string) =>
  v.pipe(v.string(), v.regex(/^\d+$/, `${label} must be a number string`));

export const workerEnvSchema = v.object({
  NODE_ENV: v.picklist(['development', 'staging', 'production']),
  DATABASE_URL: v.string(),
  REDIS_URL: v.optional(v.string()),
  IMPORT_CHUNK_SIZE: v.optional(numberString('IMPORT_CHUNK_SIZE')),
  IMPORT_MAX_ROWS: v.optional(numberString('IMPORT_MAX_ROWS'))
});

export type WorkerEnv = v.InferOutput<typeof workerEnvSchema>;
