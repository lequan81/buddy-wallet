/**
 * @repo/config - Shared Configuration & Constants
 */

export * from './shared';
export * from './env';
export * from './auth';
export * from './import';
export * from './storage';
export * from './app/backend';
export * from './app/redis';

// Utility for secret validation (from security.ts - to be moved to auth or kept in security)

export const validateSecretStrength = (secret: string) => {
  const issues: string[] = [];
  if (secret.length < 16) issues.push('Secret is too short (min 16 chars)');
  if (!/[A-Z]/.test(secret)) issues.push('Secret missing uppercase letter');
  if (!/[0-9]/.test(secret)) issues.push('Secret missing digit');
  
  return {
    isValid: issues.length === 0,
    issues
  };
};
