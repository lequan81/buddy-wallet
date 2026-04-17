export * from './app';
export * from './auth';
export * from './database';
export * from './cache';
export * from './services';

import { appConfig } from './app';
import { authConfig } from './auth';
import { databaseConfig } from './database';
import { cacheConfig } from './cache';
import { servicesConfig } from './services';

// Unified config object for backward compatibility
export const configs = {
  APP: appConfig,
  AUTH: authConfig,
  DATABASE: databaseConfig,
  CACHE: cacheConfig,
  EMAIL: servicesConfig.EMAIL,
  IMPORT: servicesConfig.IMPORT,
  STORAGE: servicesConfig.STORAGE,
  PAGINATION: appConfig.PAGINATION,
  RATE_LIMITS: servicesConfig.RATE_LIMITS,
  PUSH: servicesConfig.PUSH,
  SECURITY: servicesConfig.SECURITY
} as const;
