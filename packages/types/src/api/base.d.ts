/**
 * Base Types
 */

/**
 * Result<T> - Type-safe discriminated union for all service responses
 * No success boolean needed - presence of 'data' or 'code' indicates which case
 */
export type Result<T> = 
  | { data: T }                                    // Success: has data
  | { code: string; error?: string };             // Error: has code + optional error message

/**
 * Success variant only
 */
export type SuccessResult<T> = { data: T };

/**
 * Error variant only
 */
export type ErrorResult = { code: string; error?: string };

export type ExpiryOption = 'never' | '1d' | '3d' | '7d' | '30d' | '90d';

/**
 * @deprecated Use Result<T> instead for services
 * ApiErrorValue is only for HTTP response bodies
 */
export interface ApiErrorValue {
  code: string;
  message: string;
  details?: string;
}

export interface ElysiaSet {
  status?: number | string;
  headers?: unknown;
  cookie?: Record<string, unknown>;
}

/**
 * Standardized API Response — Single Unified Type
 *
 * Success: { data: T }
 * Error:   { error: { code, message, details? } }
 */
export type ApiResponse<T = void> =
  | { data: T }
  | { error: { code: string; message: string; details?: string } };

