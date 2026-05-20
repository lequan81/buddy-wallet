/**
 * HTTP Response Utilities
 * @logicType http
 *
 * Standardized response envelopes for ElysiaJS and Eden Treaty.
 * Handlers use these to preserve end-to-end type safety on the frontend.
 */

import { status as elysiaStatus, ElysiaCustomStatusResponse } from 'elysia';
import type { ErrorLike } from '@repo/types/api';

export function apiError<const T extends ErrorLike>(
  err: T,
  detail?: string
): ElysiaCustomStatusResponse<
  T['status'] extends number ? T['status'] : 500,
  {
    code: T['code'];
    message: string;
    detail?: string;
  }
> {
  const statusCode = (err.status || 500) as T['status'] extends number ? T['status'] : 500;
  const msg = detail || err.message || err.error || 'An error occurred';
  return elysiaStatus(statusCode as any, {
    code: err.code as T['code'],
    message: msg as string,
    ...(detail ? { detail } : {})
  }) as any;
}

export function apiSuccess<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
) {
  return {
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {})
  };
}

export function apiCreated<T>(data: T, message?: string) {
  // We use elysiaStatus here not because it's an error, but because it's
  // Elysia's built-in way to return a specific HTTP status code (201)
  // while preserving perfect type inference for Eden Treaty.
  return elysiaStatus(201, {
    data,
    ...(message ? { message } : {})
  });
}

export function apiAccepted<T>(data: T, message?: string) {
  return elysiaStatus(202, {
    data,
    ...(message ? { message } : {})
  });
}

export function apiNoContent() {
  return elysiaStatus(204, null);
}
