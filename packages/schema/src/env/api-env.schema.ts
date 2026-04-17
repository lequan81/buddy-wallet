import * as v from 'valibot';

const numberString = (label: string) =>
  v.pipe(v.string(), v.regex(/^\d+$/, `${label} must be a number string`));

export const apiEnvSchema = v.object({
  NODE_ENV: v.picklist(['development', 'staging', 'production']),
  PORT: v.optional(numberString('PORT')),
  WEB_URL: v.string(),
  DATABASE_URL: v.string(),
  REDIS_URL: v.optional(v.string()),
  JWT_SECRET: v.pipe(v.string(), v.minLength(16, 'JWT_SECRET must be at least 16 chars')),
  JWT_REFRESH_SECRET: v.pipe(v.string(), v.minLength(16, 'JWT_REFRESH_SECRET must be at least 16 chars')),
  ACCESS_TOKEN_LIFETIME: v.optional(numberString('ACCESS_TOKEN_LIFETIME')),
  REFRESH_TOKEN_LIFETIME: v.optional(numberString('REFRESH_TOKEN_LIFETIME')),
  SMTP_HOST: v.optional(v.string()),
  SMTP_PORT: v.optional(numberString('SMTP_PORT')),
  SMTP_USER: v.optional(v.string()),
  SMTP_PASSWORD: v.optional(v.string()),
  SMTP_FROM_NOREPLY: v.optional(v.string()),
  SMTP_FROM_SUPPORT: v.optional(v.string())
});

export type ApiEnv = v.InferOutput<typeof apiEnvSchema>;
