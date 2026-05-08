/**
 * @repo/config - Shared Configuration & Constants
 */

export {
  DEBT_STATUS,
  type DebtStatus,
  DEBT_DIRECTION,
  type DebtDirection,
  SECRET_VALIDATION,
  type SecretValidationResult,
  containsWeakPattern,
  MAJOR_BANKS_FALLBACK,
  SHARED_CONSTANTS,
  IMPORT_DB_FIELDS,
  MAX_PENDING_DEBTS,
  DUPLICATE_CHECK_DAYS,
  DUPLICATE_AMOUNT_TOLERANCE,
  MAX_BATCH_DELETE_SIZE,
  MIN_DEBT_AMOUNT,
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_MIME_TYPES,
  MAX_IMPORT_FILE_SIZE,
  isValidImportFile,
  TIMEOUTS,
  MAX_IMAGE_FILE_SIZE,
  ACCEPTED_IMAGE_MIME_TYPES
} from './shared';
export {
  env,
  loadAndValidateEnv,
  type EnvSchema
} from './env';
export { AUTH_CONSTANTS } from './auth';
export { IMPORT_CONFIG } from './import';
export { STORAGE_CONFIG, buildS3Endpoint } from './storage';
export { BACKEND_CONSTANTS } from './app/backend';
export { REDIS_CONFIG, buildRedisUrl } from './app/redis';
export {
  FEATURE_FLAGS,
  isEnabled,
  requireFlag,
  logFeatureFlags,
  type FeatureFlags
} from './feature-flags';
