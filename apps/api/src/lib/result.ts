/**
 * Result Type - Simplified Error Returns
 * 
 * Provides clean helpers for returning errors without redundant messages.
 * The error code + HTTP status is sufficient - messages are handled on frontend.
 */
import type { Result } from '@repo/types';

export type { Result };

/**
 * Create successful result
 * @param data The success payload
 * @returns Result with data
 */
export function ok<T>(data: T): Result<T> {
  return { data };
}

/**
 * Create error result
 * @param code Error code (e.g., "BE_0042", "GEN_006")
 * @returns Result with only code, no redundant message
 */
export function err(code: string): Result<never> {
  return { code };
}

/**
 * Safely extract data from result or throw
 * @param result Discriminated union result
 * @param fallbackError Error code if result is error
 * @returns The data if success, throws if error
 */
export function unwrap<T>(result: Result<T>, fallbackError?: string): T {
  if ('data' in result) {
    return result.data;
  }
  throw new Error(`Result error: ${result.code}`);
}

/**
 * Map error code from one code to another
 * Useful for translating database errors to API errors
 * @param result Current result
 * @param errorMap Mapping of "isError" condition to new code
 * @returns New result or original if success
 */
export function mapError<T>(
  result: Result<T>,
  mapper: (code: string) => string
): Result<T> {
  if ('code' in result) {
    return { code: mapper(result.code) };
  }
  return result;
}

/**
 * Custom error class for database operations
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Chain results for sequential operations
 * @param result Current result
 * @param fn Function to apply if result is success
 * @returns Next result
 */
export async function flatMap<T, U>(
  result: Result<T>,
  fn: (data: T) => Promise<Result<U>>
): Promise<Result<U>> {
  if ('code' in result) {
    return result as unknown as Result<U>;
  }
  return fn(result.data);
}

/**
 * Convert caught error to error result
 * Handles both DatabaseError and generic errors
 */
export function fromCatch(error: unknown, defaultCode: string): Result<never> {
  // If already has a code, use it
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return { code: error.code };
  }
  
  // Otherwise use default
  return { code: defaultCode };
}

