import { env } from '@repo/config';

const nodeEnv = Bun.env.NODE_ENV || 'development';

export const appConfig = {
  NODE_ENV: nodeEnv,
  PORT: env.string('PORT', '3000'),
  WEB_URL: env.string('WEB_URL', 'http://localhost:5173'),
  IS_PRODUCTION: nodeEnv === 'production',
  Pagination: {
    DEFAULT_LIMIT: env.int('Pagination_DEFAULT_LIMIT', 20),
    MAX_LIMIT: env.int('Pagination_MAX_LIMIT', 100),
    MAX_OFFSET: env.int('Pagination_MAX_OFFSET', 50000)
  }
};

