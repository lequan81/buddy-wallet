import { apiResponse, GEN_ERRORS, type ApiResponse } from '@repo/errors';
import type { Result } from '@repo/types';

export interface ServiceErrorMapEntry {
  status: number;
  error: { code: string; message: string };
}

export type ServiceErrorMap = Record<string, ServiceErrorMapEntry>;

export interface RespondFailureOptions {
  map?: ServiceErrorMap;
  fallback?: ServiceErrorMapEntry;
}

export const DEFAULT_FAILURE: ServiceErrorMapEntry = {
  status: 400,
  error: GEN_ERRORS.INVALID_INPUT
};

export function respondFailure(
  set: { status?: number | string },
  result: { code?: string; error?: string },
  options: RespondFailureOptions = {}
): ApiResponse<never> {
  const fallback = options.fallback ?? DEFAULT_FAILURE;
  const mapped = (result.code && options.map?.[result.code]) || fallback;

  set.status = mapped.status;

  return apiResponse({
    ok: false,
    error: mapped.error,
    details: result.error
  });
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

export function respondIfFailure<T>(
  set: { status?: number | string },
  result: Result<T>,
  options: RespondFailureOptions = {}
): ApiResponse<never> | null {
  if (!isFailureResult(result)) {
    return null;
  }

  return respondFailure(set, result, options);
}
