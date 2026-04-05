import { errorResponse, GEN_ERRORS } from '@repo/errors';
import type { User } from '@repo/db';
import type { ElysiaSet } from '@/types';

/**
 * Guard helper for authenticated endpoints.
 * Returns typed user when available, otherwise writes 401 and returns error payload.
 */
export function requireAuth(
  user: User | null | undefined,
  set: ElysiaSet,
  message?: string
): { user: User } | { error: ReturnType<typeof errorResponse> } {
  if (!user) {
    set.status = 401;
    return {
      error: errorResponse(GEN_ERRORS.UNAUTHORIZED, message)
    };
  }

  return { user };
}
