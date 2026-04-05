/**
 * Environment utilities for cross-runtime (Vite, Bun, Node)
 */

import { throwOnValidationError, validateEnv } from './validation';
import type { EnvSchema } from './schema';

export const optionalEnv = (key: string, defaultValue?: string): string => {
  try {
    // 1. Vite / Frontend (Meta)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const val = (import.meta as any).env[key];
      if (val !== undefined) return val;
    }

    // 2. Bun (Bun.env)
    if (typeof Bun !== 'undefined' && Bun.env) {
      const val = Bun.env[key];
      if (val !== undefined) return val;
    }

    // 3. Node (process.env)
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key];
      if (val !== undefined) return val;
    }
  } catch (e) {
    // Suppress errors during env lookup
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  return '';
};

export const requiredEnv = (key: string, defaultValue?: string): string => {
  const value = optionalEnv(key, defaultValue);
  if (!value) {
    throw new Error(`Required environment variable not set: ${key}`);
  }

  return value;
};

export const getEnvInt = (key: string, defaultValue?: number): number => {
  const val = optionalEnv(key, '');
  if (!val) {
    if (defaultValue === undefined) {
      throw new Error(`Required integer env var not set: ${key}`);
    }
    return defaultValue;
  }

  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) {
    if (defaultValue !== undefined) {
      console.warn(`[WARN] Invalid number for ${key}: ${val}. Using default ${defaultValue}`);
      return defaultValue;
    }
    throw new Error(`Invalid number for ${key}: ${val}`);
  }

  return parsed;
};

export const getEnvBool = (key: string, defaultValue = false): boolean => {
  const val = optionalEnv(key, '');
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return defaultValue;
};

export const loadAndValidateEnv = (): void => {
  const envObj =
    typeof Bun !== 'undefined'
      ? Bun.env
      : typeof process !== 'undefined'
        ? process.env
        : {};

  const result = validateEnv(envObj as Record<string, unknown>);
  throwOnValidationError(result);
};

export type { EnvSchema };
