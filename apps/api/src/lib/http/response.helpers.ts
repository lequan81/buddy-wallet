/**
 * Controller Response Helpers
 *
 * Shared helper for extracting and validating the authenticated user
 * in controller handlers. Eliminates the repeated 6-line boilerplate
 * pattern across all controllers.
 */
import type { User } from '@repo/db';
import type { CurrentUser } from '@repo/types';
import { apiResponse, GEN_ERRORS, type ApiResponse } from '@repo/errors';
import { requireAuth } from './require-auth';
import { getUserWithFreshData } from '@/lib/plugins/auth';

function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    permissions: user.permissions ?? [],
    role: user.role,
    email: user.email
  };
}

type ActorResult =
  | { ok: true; user: User; actor: CurrentUser }
  | { ok: false; error: ApiResponse<never> };

/**
 * Resolve the authenticated user and map to a CurrentUser actor.
 *
 * Replaces the repeated pattern:
 * ```ts
 * const auth = requireAuth(user, set);
 * if ('error' in auth) return auth.error;
 * const freshUser = await getUserWithFreshData(auth.user.id);
 * if (!freshUser) { set.status = 401; return apiResponse({...}); }
 * const actor = toCurrentUser(freshUser);
 * ```
 *
 * Usage:
 * ```ts
 * const resolved = await resolveActor(user, set);
 * if (!resolved.ok) return resolved.error;
 * const { actor, user: freshUser } = resolved;
 * ```
 */
export async function resolveActor(
  user: User | null | undefined,
  set: { status?: number | string }
): Promise<ActorResult> {
  const auth = requireAuth(user, set);
  if ('error' in auth) {
    return { ok: false, error: auth.error };
  }

  const freshUser = await getUserWithFreshData(auth.user.id);
  if (!freshUser) {
    set.status = 401;
    return {
      ok: false,
      error: apiResponse({ ok: false, error: GEN_ERRORS.UNAUTHORIZED, details: 'User not found' })
    };
  }

  return { ok: true, user: freshUser, actor: toCurrentUser(freshUser) };
}
