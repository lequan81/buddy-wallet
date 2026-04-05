import { apiResponse, GEN_ERRORS, type ErrorResponse } from '@repo/errors';
import type { User } from '@repo/db';
import type { ElysiaSet } from '@repo/types';

/**
 * Guard helper for authenticated endpoints.
 * Returns typed user when available, otherwise writes 401 and returns error payload.
 */
export function requireAuth(
  user: User | null | undefined,
  set: ElysiaSet,
  message?: string
): { user: User } | { error: ErrorResponse } {
  if (!user) {
    set.status = 401;
    return {
      error: apiResponse({ ok: false, error: GEN_ERRORS.UNAUTHORIZED, details: message })
    };
  }

  return { user };
}
