export interface EnvSchema {
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  WEB_URL: string;

  DATABASE_URL: string;
  REDIS_URL?: string;

  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CSRF_SECRET?: string;
  ACCESS_TOKEN_LIFETIME: number;
  REFRESH_TOKEN_LIFETIME: number;

  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;

  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;

  IMPORT_MAX_ROWS: number;
  IMPORT_CHUNK_SIZE: number;

  PAGINATION_DEFAULT_LIMIT: number;
  PAGINATION_MAX_LIMIT: number;
  PAGINATION_MAX_OFFSET: number;

  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM_NOREPLY?: string;
  SMTP_FROM_SUPPORT?: string;
}
