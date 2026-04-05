const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

const OPTIONAL_VARS = [
  'REDIS_URL',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'VAPID_PUBLIC_KEY',
  'SMTP_HOST'
] as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateEnv = (env: Record<string, unknown>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = String(env.NODE_ENV || 'development');
  const isProd = nodeEnv === 'production';

  for (const key of REQUIRED_VARS) {
    const value = env[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      const message = `Missing required environment variable: ${key}`;
      if (isProd) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  const jwtSecret = env.JWT_SECRET;
  if (typeof jwtSecret === 'string' && jwtSecret.length > 0 && jwtSecret.length < 32) {
    const message = `JWT_SECRET too weak (${jwtSecret.length} chars, need 32+)`;
    if (isProd) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  const dangerousDefaults = [
    'dev-secret-change-in-production',
    'change-me',
    'secret123'
  ];
  if (typeof jwtSecret === 'string' && dangerousDefaults.includes(jwtSecret)) {
    errors.push('JWT_SECRET has dangerous default value. Set a unique secret in .env');
  }

  for (const key of OPTIONAL_VARS) {
    const value = env[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      warnings.push(`Optional feature disabled: ${key} not set`);
    }
  }

  for (const key of ['PORT', 'ACCESS_TOKEN_LIFETIME', 'REFRESH_TOKEN_LIFETIME']) {
    const value = env[key];
    if (value !== undefined && value !== null && value !== '' && Number.isNaN(Number(value))) {
      errors.push(`Invalid number format for ${key}: ${String(value)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export const throwOnValidationError = (
  result: ValidationResult,
  context = 'Environment validation'
): void => {
  if (result.warnings.length > 0) {
    console.warn(`[WARN] ${context} warnings:`);
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.error(`[ERROR] ${context} failed:`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    throw new Error(
      `${context} failed with ${result.errors.length} error(s). Fix .env and restart.`
    );
  }
};
