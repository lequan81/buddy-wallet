/**
 * Environment utilities - Type-first fluent API
 * 
 * Features:
 * - Works across all runtimes (Vite, Bun, Node, Deno)
 * - Type-safe with function overloads
 * - Consistent error messages
 * - No internal caching (always fresh reads for dev-friendly hot-reload)
 * 
 * @example
 * const port = env.port('PORT', 3000);
 * const debug = env.bool('DEBUG');
 * const apiUrl = env.url('API_URL');
 */

import { throwOnValidationError, validateEnv } from './validation';
import type { EnvSchema } from './schema';

// ─────────────────────────────────────────────────────────────
// Internal: Get raw env value from any runtime
// ─────────────────────────────────────────────────────────────

function getRaw(key: string): string | undefined {
  try {
    // 1. Vite/Frontend (import.meta.env)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const val = (import.meta as any).env[key];
      if (val !== undefined) return val;
    }

    // 2. Bun (Bun.env)
    const globalBun = (globalThis as any).Bun;
    if (globalBun && globalBun.env) {
      const val = globalBun.env[key];
      if (val !== undefined) return val;
    }

    // 3. Node (process.env)
    const globalProcess = (globalThis as any).process;
    if (globalProcess && globalProcess.env) {
      const val = globalProcess.env[key];
      if (val !== undefined) return val;
    }
  } catch (e) {
    // Suppress errors during env lookup
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Public API: Fluent type-first functions
// ─────────────────────────────────────────────────────────────

/**
 * Read environment variable as string
 * 
 * @param key - Environment variable name
 * @param defaultValue - Optional default if not found
 * @returns String value or default
 * @throws Error if not found and no default provided
 * 
 * @example
 * const apiUrl = env.string('API_URL');           // throws if missing
 * const name = env.string('APP_NAME', 'MyApp');   // falls back to 'MyApp'
 */
function string(key: string): string;
function string(key: string, defaultValue: string): string;
function string(key: string, defaultValue?: string): string {
  const val = getRaw(key);

  if (val !== undefined) return val;
  if (defaultValue !== undefined) return defaultValue;

  throw new Error(`Missing required environment variable: ${key}`);
}

/**
 * Read environment variable as integer
 * 
 * @param key - Environment variable name
 * @param defaultValue - Optional default if not found or invalid
 * @returns Integer value or default
 * @throws Error if not a valid number and no default provided
 * 
 * @example
 * const port = env.int('PORT');                   // throws if missing
 * const maxSize = env.int('MAX_SIZE', 1000);      // defaults to 1000
 */
function int(key: string): number;
function int(key: string, defaultValue: number): number;
function int(key: string, defaultValue?: number): number {
  const val = getRaw(key);

  if (val === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }

  const parsed = parseInt(val, 10);

  if (Number.isNaN(parsed)) {
    if (defaultValue !== undefined) {
      console.warn(`[ENV_WARN] Invalid number for ${key}: "${val}". Using default ${defaultValue}`);
      return defaultValue;
    }
    throw new Error(`Invalid number for ${key}: "${val}"`);
  }

  return parsed;
}

/**
 * Read environment variable as boolean
 * 
 * Truthy: "true", "1", "yes", "on" (case-insensitive)
 * Falsy: "false", "0", "no", "off", or empty string
 * 
 * @example
 * const debug = env.bool('DEBUG');               // false if missing
 * const verbose = env.bool('VERBOSE', true);     // defaults to true
 */
function bool(key: string, defaultValue = false): boolean {
  const val = getRaw(key);

  if (val === undefined) return defaultValue;

  const lower = val.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off' || lower === '') {
    return false;
  }

  console.warn(`[ENV_WARN] Invalid boolean for ${key}: "${val}". Using default ${defaultValue}`);
  return defaultValue;
}

/**
 * Read environment variable as valid port number (0-65535)
 * 
 * @param key - Environment variable name
 * @param defaultValue - Optional default port number
 * @returns Valid port number
 * @throws Error if not a valid port (not a number or out of range)
 * 
 * @example
 * const port = env.port('PORT');                 // throws if invalid or missing
 * const port = env.port('PORT', 3000);           // defaults to 3000
 */
function port(key: string): number;
function port(key: string, defaultValue: number): number;
function port(key: string, defaultValue?: number): number {
  const val = defaultValue !== undefined ? int(key, defaultValue) : int(key);

  if (val < 0 || val > 65535) {
    if (defaultValue !== undefined && defaultValue >= 0 && defaultValue <= 65535) {
      console.warn(`[ENV_WARN] Invalid port for ${key}: ${val}. Using default ${defaultValue}`);
      return defaultValue;
    }
    throw new Error(`Invalid port for ${key}: ${val} (must be 0-65535)`);
  }

  return val;
}

/**
 * Read environment variable as URL
 * 
 * @param key - Environment variable name
 * @param defaultValue - Optional default URL string
 * @returns Parsed URL object
 * @throws Error if not a valid URL
 * 
 * @example
 * const dbUrl = env.url('DATABASE_URL');         // throws if invalid or missing
 * const apiUrl = env.url('API_URL', 'http://localhost:3000');
 */
function url(key: string): URL;
function url(key: string, defaultValue: string): URL;
function url(key: string, defaultValue?: string): URL {
  const val = getRaw(key);
  const strVal = val ?? defaultValue;

  if (!strVal) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  try {
    return new URL(strVal);
  } catch (e) {
    throw new Error(
      `Invalid URL for ${key}: "${strVal}" - ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Namespace export
// ─────────────────────────────────────────────────────────────

/**
 * Environment variable accessor with fluent type-first API
 * 
 * @example
 * const port = env.port('PORT', 3000);
 * const debug = env.bool('DEBUG');
 * const secret = env.string('API_SECRET');
 * const maxConnections = env.int('DB_MAX_CONNECTIONS', 10);
 * const authUrl = env.url('AUTH_URL');
 */
export const env = {
  string,
  int,
  bool,
  port,
  url
} as const;

/**
 * Validate all environment variables against schema
 */
export const loadAndValidateEnv = (): void => {
  const globalBun = (globalThis as any).Bun;
  const globalProcess = (globalThis as any).process;

  const envObj =
    globalBun && globalBun.env
      ? globalBun.env
      : globalProcess && globalProcess.env
        ? globalProcess.env
        : {};

  const result = validateEnv(envObj as Record<string, unknown>);
  throwOnValidationError(result);
};

export type { EnvSchema };
