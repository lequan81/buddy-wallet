import { errorResponse, GEN_ERRORS } from '@repo/errors';
import type { User } from '@repo/db';

type SetLike = {
  status?: number | string;
};

/**
 * Guard helper for authenticated endpoints.
 * Returns typed user when available, otherwise writes 401 and returns error payload.
 */
export function requireAuth(
  user: User | null | undefined,
  set: SetLike,
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
