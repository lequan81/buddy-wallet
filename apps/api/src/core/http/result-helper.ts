import { apiResponse, GEN_ERRORS, type ErrorDefinition, type ApiResponse } from '@repo/errors';

export interface ServiceFailureResult {
  success: boolean;
  error?: string;
  code?: string;
}

export interface ServiceErrorMapEntry {
  status: number;
  error: ErrorDefinition;
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
  result: ServiceFailureResult,
  options: RespondFailureOptions = {}
): ApiResponse<never> {
  const fallback = options.fallback ?? DEFAULT_FAILURE;
  const mapped = (result.code && options.map?.[result.code]) || (result.error && options.map?.[result.error]) || fallback;

  set.status = mapped.status;

  return apiResponse({
    ok: false,
    error: mapped.error,
    details: result.error
  });
}

export function isFailureResult<T extends { success: boolean }>(
  result: T
): result is T & { success: false } {
  return result.success === false;
}

export function respondIfFailure(
  set: { status?: number | string },
  result: ServiceFailureResult,
  options: RespondFailureOptions = {}
): ApiResponse<never> | null {
  if (!isFailureResult(result)) {
    return null;
  }

  return respondFailure(set, result, options);
}
