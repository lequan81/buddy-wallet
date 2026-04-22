/**
 * API Response Helpers
 *
 * Defines the standardized Response format for the application.
 * Follows the discriminated union pattern: { data } OR { error }.
 */

import type { ApiResponse, Result } from '@repo/types';

/**
 * Create a successful API Response
 */
export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { data };
}

/**
 * Create an error API Response
 */
export function apiError(
  error: { code: string; message: string },
  details?: string
): ApiResponse<never> {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(details ? { details } : {}),
    },
  };
}


/**
 * Check if a result is a failure (using new Result union type)
 */
export function isFailureResult<T>(
  result: Result<T>
): result is { code: string; error?: string } {
  return 'code' in result;
}

/**
 * Check if a result is a success (using new Result union type)
 */
export function isSuccessResult<T>(
  result: Result<T>
): result is { data: T } {
  return 'data' in result;
}

