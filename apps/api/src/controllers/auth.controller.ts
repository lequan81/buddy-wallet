/**
 * Auth Controller
 *
 * Thin controller that delegates to authService and sessionService.
 * Handles HTTP concerns (cookies, headers, status codes) only.
 */
import { Elysia, t } from 'elysia';
import { sessionAuthPlugin } from '@plugins/session-auth';
import { authRateLimiter } from '@plugins/rate-limit';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@plugins/redis';
import { configs } from '@/configs';
import { authService, sessionService } from '@/services';
import { getClientIP, hashToken } from '@utils';

export const authController = new Elysia({ prefix: '/auth' })
  .use(sessionAuthPlugin)
  .use(authRateLimiter) // Rate limit: 10 requests per minute

  // ==================== REGISTER ====================
  .post(
    '/register',
    async ({ body, set }) => {
      const result = await authService.register(body);

      if (!result.success) {
        set.status = 400;
        return { success: false, message: result.error };
      }

      set.status = 200;
      return { success: true, user: result.user };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        phoneNumber: t.String({ minLength: 10 }),
        email: t.Optional(t.String({ format: 'email' })),
        password: t.String({ minLength: 8 })
      })
    }
  )

  // ==================== LOGIN ====================
  .post(
    '/login',
    async ({ body, jwt, cookie, set, request }) => {
      const userAgent = request.headers.get('user-agent');
      const clientIP = getClientIP(request) || request.headers.get('x-forwarded-for');

      const result = await authService.login(
        {
          identifier: body.email,
          password: body.password,
          userAgent,
          clientIP
        },
        jwt
      );

      if (!result.success) {
        set.status = 401;
        return { success: false, error: result.error };
      }

      // Set access token cookie (short-lived)
      cookie.session.set({
        value: result.accessToken!,
        httpOnly: true,
        secure: configs.APP.IS_PROD,
        sameSite: 'strict',
        path: '/',
        maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
      });

      // Set refresh token cookie (long-lived)
      cookie.refresh_token.set({
        value: result.refreshToken!,
        httpOnly: true,
        secure: configs.APP.IS_PROD,
        sameSite: 'strict',
        path: '/',
        maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000
      });

      set.status = 200;
      return {
        success: true,
        user: result.user,
        expiresIn: result.expiresIn
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    }
  )

  // ==================== REFRESH ====================
  .post('/refresh', async ({ jwt, cookie, set, request }) => {
    const refreshToken = cookie.refresh_token.value as string;

    const result = await sessionService.refreshSession(refreshToken, jwt, {
      userAgent: request.headers.get('user-agent'),
      clientIP: getClientIP(request)
    });

    if (!result.success) {
      cookie.session.remove();
      cookie.refresh_token.remove();
      set.status = 401;
      return { success: false, error: result.error };
    }

    // Set new access token cookie
    cookie.session.set({
      value: result.accessToken!,
      httpOnly: true,
      secure: configs.APP.IS_PROD,
      sameSite: 'strict',
      path: '/',
      maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
    });

    set.status = 200;
    return {
      success: true,
      user: result.user,
      expiresIn: result.expiresIn
    };
  })

  // ==================== ME ====================
  .get('/me', async ({ user }) => {
    return { user };
  })

  // ==================== LOGOUT ====================
  .post('/logout', async ({ user, cookie, set }) => {
    const refreshToken = cookie.refresh_token.value as string;
    const accessToken = cookie.session.value as string;

    // Security: Require at least one valid token
    if (!refreshToken && !accessToken) {
      set.status = 401;
      return { success: false, error: 'No valid session' };
    }

    if (refreshToken) {
      const result = await authService.logout(refreshToken, user?.id);
      if (!result.success) {
        set.status = 403;
        return result;
      }

      // Blacklist the access token
      if (isRedisAvailable() && accessToken) {
        await sessionCache.del(accessToken);
        await jwtBlacklist.add(accessToken, configs.AUTH.JWT_BLACKLIST_SECONDS);
      }
    }

    // Clear both cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return { success: true };
  })

  // ==================== LOGOUT ALL ====================
  .post('/logout-all', async ({ user, cookie, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    await sessionService.revokeAllSessions(user.id);

    // Clear current session cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return { success: true, message: 'All sessions have been logged out' };
  })

  // ==================== LIST SESSIONS ====================
  .get('/sessions', async ({ user, cookie, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const refreshToken = cookie.refresh_token.value as string;
    const result = await sessionService.getUserSessions(user.id, refreshToken);

    return { success: true, ...result };
  })

  // ==================== REVOKE SESSION ====================
  .post(
    '/sessions/:sessionId/revoke',
    async ({ user, params, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      const refreshToken = cookie.refresh_token.value as string;
      const result = await sessionService.revokeSession(params.sessionId, user.id, refreshToken);

      if (!result.success) {
        set.status = 404;
        return result;
      }

      // If user revoked their current session, clear cookies
      if (result.isCurrent) {
        cookie.session.remove();
        cookie.refresh_token.remove();
      }

      return { success: true, message: 'Session revoked' };
    },
    {
      params: t.Object({
        sessionId: t.String()
      })
    }
  )

  // ==================== CHANGE PASSWORD ====================
  .post(
    '/change-password',
    async ({ user, body, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      // Get current session ID
      let currentSessionId: string | null = null;
      const refreshToken = cookie.refresh_token.value as string;
      if (refreshToken) {
        const refreshTokenHash = await hashToken(refreshToken);
        const { sessions } = await sessionService.getUserSessions(user.id);
        // Find matching session (simplified)
        currentSessionId = sessions[0]?.id || null;
      }

      const result = await authService.changePassword(
        user.id,
        body.currentPassword,
        body.newPassword,
        currentSessionId || undefined
      );

      if (!result.success) {
        set.status = 400;
        return result;
      }

      return {
        success: true,
        message: 'Password changed successfully. Other sessions have been logged out.'
      };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: configs.AUTH.MIN_PASSWORD_LENGTH })
      })
    }
  );
