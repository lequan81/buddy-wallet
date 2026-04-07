/**
 * Base Types
 */
export interface BaseResult {
  success: boolean;
  message?: string;
  code?: string;
  error?: string;
}

export type ExpiryOption = 'never' | '1d' | '3d' | '7d' | '30d' | '90d';

export interface ApiErrorValue {
  success: false;
  error?: string | { message: string; code?: string };
  code?: string;
  message?: string;
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
 * Success: { success: true, data: T }
 * Error:   { success: false, error: { code, message, details? } }
 */
export type ApiResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: string } };

