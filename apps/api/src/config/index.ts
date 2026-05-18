export * from './app';
export * from './auth';
export * from './database';
export * from './cache';
export * from './services';
 
import { loadAndValidateEnv, env } from '@repo/config';
import { appConfig } from './app';
import { authConfig } from './auth';
import { databaseConfig } from './database';
import { cacheConfig } from './cache';
import { servicesConfig } from './services';

const nodeEnv = env.string('NODE_ENV', 'development');
let envValidated = false;

/**
 * Startup Validation - Ensures environment is ready
 */
export const validateRuntimeEnv = (): void => {
  if (envValidated || nodeEnv === 'test') {
    return;
  }
  loadAndValidateEnv();
  envValidated = true;
};

// Unified config object for backward compatibility
export const configs = {
  APP: appConfig,
  AUTH: authConfig,
  DATABASE: databaseConfig,
  CACHE: cacheConfig,
  EMAIL: servicesConfig.EMAIL,
  IMPORT: servicesConfig.IMPORT,
  STORAGE: servicesConfig.STORAGE,
  Pagination: appConfig.Pagination,
  RATE_LIMITS: servicesConfig.RATE_LIMITS,
  PUSH: servicesConfig.PUSH,
  SECURITY: servicesConfig.SECURITY
} as const;

