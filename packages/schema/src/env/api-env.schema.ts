import * as v from 'valibot';

export const apiEnvSchema = v.object({
  NODE_ENV: v.union([v.literal('development'), v.literal('staging'), v.literal('production')]),
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/))),
  WEB_URL: v.string(),
  DATABASE_URL: v.string(),
  REDIS_URL: v.optional(v.string()),
  JWT_SECRET: v.pipe(v.string(), v.minLength(16)),
  JWT_REFRESH_SECRET: v.pipe(v.string(), v.minLength(16)),
  ACCESS_TOKEN_LIFETIME: v.optional(v.pipe(v.string(), v.regex(/^\d+$/))),
  REFRESH_TOKEN_LIFETIME: v.optional(v.pipe(v.string(), v.regex(/^\d+$/))),
  SMTP_HOST: v.optional(v.string()),
  SMTP_PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/))),
  SMTP_USER: v.optional(v.string()),
  SMTP_PASSWORD: v.optional(v.string()),
  SMTP_FROM_NOREPLY: v.optional(v.string()),
  SMTP_FROM_SUPPORT: v.optional(v.string()),
});

export type ApiEnv = v.InferOutput<typeof apiEnvSchema>;
