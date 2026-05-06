import { Type, type Static } from '@sinclair/typebox';

export const workerEnvSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('staging'), Type.Literal('production')]),
  DATABASE_URL: Type.String(),
  REDIS_URL: Type.Optional(Type.String()),
  IMPORT_CHUNK_SIZE: Type.Optional(Type.String({ pattern: '^\\d+$' })),
  IMPORT_MAX_ROWS: Type.Optional(Type.String({ pattern: '^\\d+$' }))
});

export type WorkerEnv = Static<typeof workerEnvSchema>;
