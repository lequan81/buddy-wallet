import { Type, type Static } from '@sinclair/typebox';

export const apiEnvSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('staging'), Type.Literal('production')]),
  PORT: Type.Optional(Type.String({ pattern: '^\\d+$' })),
  WEB_URL: Type.String(),
  DATABASE_URL: Type.String(),
  REDIS_URL: Type.Optional(Type.String()),
  JWT_SECRET: Type.String({ minLength: 16 }),
  JWT_REFRESH_SECRET: Type.String({ minLength: 16 }),
  ACCESS_TOKEN_LIFETIME: Type.Optional(Type.String({ pattern: '^\\d+$' })),
  REFRESH_TOKEN_LIFETIME: Type.Optional(Type.String({ pattern: '^\\d+$' })),
  SMTP_HOST: Type.Optional(Type.String()),
  SMTP_PORT: Type.Optional(Type.String({ pattern: '^\\d+$' })),
  SMTP_USER: Type.Optional(Type.String()),
  SMTP_PASSWORD: Type.Optional(Type.String()),
  SMTP_FROM_NOREPLY: Type.Optional(Type.String()),
  SMTP_FROM_SUPPORT: Type.Optional(Type.String())
});

export type ApiEnv = Static<typeof apiEnvSchema>;
