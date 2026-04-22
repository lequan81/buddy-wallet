import { env } from '@repo/config';

export const databaseConfig = {
  // Database configuration
  // Currently buddy-wallet uses @repo/db which manages its own Connection,
  // but we can store DB-specific limits or circuit breaker settings here.
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: env.int('DB_CB_FAILURE_THRESHOLD', 5),
    RESET_TIMEOUT_MS: env.int('DB_CB_RESET_TIMEOUT_MS', 60000)
  }
};

