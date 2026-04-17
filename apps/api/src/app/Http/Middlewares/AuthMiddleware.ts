/**
 * Auth Middleware
 *
 * Validates and extracts user from session/JWT token.
 */

import { Elysia } from 'elysia';
import { UnauthorizedException } from '@/app/Exceptions';

/**
 * Require authentication middleware
 * Throws UnauthorizedException if user not authenticated
 */
export const requireAuthMiddleware = new Elysia({ name: 'RequireAuth' })
  .onBeforeHandle(async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      throw new UnauthorizedException('Authentication required');
    }
  });
