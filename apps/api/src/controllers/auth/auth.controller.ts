/**
 * Auth Controller
 *
 * Thin controller that delegates to auth services via DI.
 * Handles HTTP concerns (cookies, headers, status codes) only.
 */
import { Elysia, t } from 'elysia';
import { RegisterSchema, LoginSchema } from '@repo/schemas';
import { GEN_ERRORS, BE_ERRORS, apiResponse } from '@repo/errors';
import { sessionAuthPlugin } from '@plugins/auth';
import {
  authIdentifierRateLimiter,
  authOtpRateLimiter,
  authRateLimiter,
  authRecoveryRateLimiter,
  authResetRateLimiter
} from '@plugins/middleware';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@plugins/redis';
import { configs } from '@/configs';
import { getClientIP, hashToken, toSafeUser } from '@utils';
import { servicesPlugin } from '@plugins';
import { respondFailure, isFailureResult } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';
import {
  AUTH_REGISTER_ERROR_MAP,
  DEFAULT_AUTH_REGISTER_FAILURE
} from '@/core/http/error-maps/auth.error-map';

export const AuthController = new Elysia({ prefix: '/auth' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(authRateLimiter) // Rate limit: 10 requests per minute

  // ==================== REGISTER ====================
  .post(
    '/register',
    async ({ body, set, authCoreService }) => {
      const result = await authCoreService.register(body);

      if (isFailureResult(result)) {
        if (result.error === 'DATABASE_ERROR') {
          set.status = 503;
          set.headers['Retry-After'] = '30';
          return apiResponse({
            ok: false,
            error: BE_ERRORS.DB_CONNECTION,
            details: 'Service unavailable. Please try again later.'
          });
        }

        return respondFailure(set, result, {
          map: AUTH_REGISTER_ERROR_MAP,
          fallback: DEFAULT_AUTH_REGISTER_FAILURE
        });
      }

      set.status = 200;
      return apiResponse({ ok: true, data: { user: result.user } });
    },
    {
      body: RegisterSchema
    }
  )

  // ==================== LOGIN ====================
  .group('', (app) =>
    app.use(authIdentifierRateLimiter).post(
      '/login',
      async ({ body, jwt, cookie, set, request, server, authSecurityService, activityService }) => {
        const userAgent = request.headers.get('user-agent');
        const clientIP = getClientIP(request, server);

        const result = await authSecurityService.login(
          {
            identifier: body.email,
            password: body.password,
            userAgent,
            clientIP
          },
          jwt
        );

        if (isFailureResult(result)) {
          if (result.error === 'DATABASE_ERROR') {
            set.status = 503;
            set.headers['Retry-After'] = '30';
            return apiResponse({
              ok: false,
              error: BE_ERRORS.DB_CONNECTION,
              details: 'Service unavailable. Please try again later.'
            });
          }

          set.status = 401;
          return apiResponse({
            ok: false,
            error: BE_ERRORS.AUTH_INVALID_CREDENTIALS,
            details: result.error
          });
        }

        // Set access token cookie (short-lived)
        cookie.session.set({
          value: result.accessToken!,
          httpOnly: true,
          secure: configs.APP.IS_PRODUCTION,
          sameSite: 'lax',
          path: '/',
          maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
        });

        // Set refresh token cookie (long-lived)
        cookie.refresh_token.set({
          value: result.refreshToken!,
          httpOnly: true,
          secure: configs.APP.IS_PRODUCTION,
          sameSite: 'lax',
          path: '/',
          maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000
        });

        // Log the login activity
        await activityService.log({
          userId: result.user!.id,
          action: 'login',
          resource: 'session',
          ipAddress: clientIP || undefined,
          userAgent: userAgent || undefined
        });

        set.status = 200;
        return apiResponse({
          ok: true,
          data: {
          user: result.user,
          expiresIn: result.expiresIn,
          mustChangePassword: result.mustChangePassword
        }});
      },
      {
        body: LoginSchema
      }
    )
  )

  // ==================== REFRESH ====================
  .post('/refresh', async ({ jwt, cookie, set, request, server, sessionService }) => {
    const refreshToken = cookie.refresh_token.value as string;

    const result = await sessionService.refreshSession(refreshToken, jwt, {
      userAgent: request.headers.get('user-agent'),
      clientIP: getClientIP(request, server)
    });

    if (isFailureResult(result)) {
      cookie.session.remove();
      cookie.refresh_token.remove();
      set.status = 401;
      return apiResponse({
        ok: false,
        error: BE_ERRORS.AUTH_SESSION_EXPIRED,
        details: result.error
      });
    }

    // Set new access token cookie
    cookie.session.set({
      value: result.accessToken!,
      httpOnly: true,
      secure: configs.APP.IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
    });

    // REFRESH TOKEN ROTATION: Set new refresh token cookie
    if (result.refreshToken) {
      cookie.refresh_token.set({
        value: result.refreshToken,
        httpOnly: true,
        secure: configs.APP.IS_PRODUCTION,
        sameSite: 'lax',
        path: '/',
        maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000
      });
    }

    set.status = 200;
    return apiResponse({
      ok: true,
      data: {
      user: result.user,
      expiresIn: result.expiresIn
    }});
  })

  // ==================== ME ====================
  .get('/me', async ({ user, set }) => {
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;
    
    return apiResponse({
      ok: true,
      data: { user: toSafeUser(resolved.user) }
    });
  })

  // ==================== LOGOUT ====================
  .post('/logout', async ({ user, cookie, set, request, server, authSessionService, activityService }) => {
    const refreshToken = cookie.refresh_token.value as string;
    const accessToken = cookie.session.value as string;

    // Security: Require at least one valid token
    if (!refreshToken && !accessToken) {
      set.status = 401;
      return apiResponse({ ok: false, error: BE_ERRORS.AUTH_NO_SESSION });
    }

    if (refreshToken) {
      const result = await authSessionService.logout(refreshToken, user?.id);
      if (isFailureResult(result)) {
        set.status = 403;
        return apiResponse({ ok: false, error: GEN_ERRORS.FORBIDDEN, details: result.error });
      }

      // Blacklist the access token
      if (isRedisAvailable() && accessToken) {
        const tokenHash = await hashToken(accessToken); // SECURITY: Hash before blacklisting
        await sessionCache.del(tokenHash);
        await jwtBlacklist.add(tokenHash, configs.AUTH.JWT_BLACKLIST_SECONDS);
      }
    }

    // Log the logout activity
    if (user) {
      await activityService.log({
        userId: user.id,
        action: 'logout',
        resource: 'session',
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });
    }

    // Clear both cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return apiResponse({ ok: true, data: { message: 'Logged out successfully' } });
  })

  // ==================== LOGOUT ALL ====================
  .post('/logout-all', async ({ user, cookie, set, request, server, sessionService, activityService }) => {
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;
    const { user: freshUser } = resolved;

    await sessionService.revokeAllSessions(freshUser.id);

    // Log the logout-all activity
    await activityService.log({
      userId: freshUser.id,
      action: 'logout_all',
      resource: 'session',
      ipAddress: getClientIP(request, server) || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    // Clear current session cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return apiResponse({ ok: true, data: { message: 'All sessions have been logged out' } });
  })

  // ==================== LIST SESSIONS ====================
  .get('/sessions', async ({ user, cookie, set, sessionService }) => {
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;
    const { user: freshUser } = resolved;

    const refreshToken = cookie.refresh_token.value as string;
    const result = await sessionService.getUserSessions(freshUser.id, refreshToken);

    return apiResponse({ ok: true, data: result });
  })

  // ==================== REVOKE SESSION ====================
  .post(
    '/sessions/:sessionId/revoke',
    async ({ user, params, cookie, set, sessionService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const refreshToken = cookie.refresh_token.value as string;
      const result = await sessionService.revokeSession(params.sessionId, freshUser.id, refreshToken);

      if (isFailureResult(result)) {
        set.status = 404;
        return apiResponse({ ok: false, error: GEN_ERRORS.NOT_FOUND, details: result.error });
      }

      // If user revoked their current session, clear cookies
      if (result.isCurrent) {
        cookie.session.remove();
        cookie.refresh_token.remove();
      }

      return apiResponse({ ok: true, data: { message: 'Session revoked' } });
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
    async ({ user, body, cookie, set, authSessionService, sessionService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      // Get current session ID
      let currentSessionId: string | null = null;
      const refreshToken = cookie.refresh_token.value as string;
      if (refreshToken) {
        const { sessions } = await sessionService.getUserSessions(freshUser.id);
        // Find matching session (simplified)
        currentSessionId = sessions[0]?.id || null;
      }

      const result = await authSessionService.changePassword(
        freshUser.id,
        body.currentPassword,
        body.newPassword,
        currentSessionId || undefined
      );

      if (isFailureResult(result)) {
        set.status = 400;
        return apiResponse({
          ok: false,
          error: BE_ERRORS.AUTH_PASSWORD_MISMATCH,
          details: result.error
        });
      }

      return apiResponse({
        ok: true,
        data: {
        message: 'Password changed successfully. Other sessions have been logged out.'
      }});
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: configs.AUTH.PASSWORD_MIN_LENGTH })
      })
    }
  )

  // ==================== VERIFY OTP ====================
  .group('', (app) =>
    app.use(authOtpRateLimiter).post(
      '/verify-otp',
      async ({ body, set, emailVerificationService }) => {
        const result = await emailVerificationService.verifyOtp(body.email, body.otp);

        if (isFailureResult(result)) {
          set.status = 400;
          return apiResponse({ ok: false, error: GEN_ERRORS.INVALID_INPUT, details: result.error });
        }

        return apiResponse({ ok: true, data: { message: 'Email verified successfully' } });
      },
      {
        body: t.Object({
          email: t.String({ format: 'email' }),
          otp: t.String({ minLength: 6, maxLength: 6 })
        })
      }
    )
  )

  // ==================== RESEND OTP ====================
  .group('', (app) =>
    app.use(authOtpRateLimiter).post('/resend-otp', async ({ user, set, emailVerificationService, emailService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const result = await emailVerificationService.resendOtp(freshUser.id);

      if (isFailureResult(result)) {
        set.status = 429; // Too Many Requests
        const details = result.retryAfter
          ? `${result.error} Retry after ${result.retryAfter} seconds.`
          : result.error;
        return apiResponse({ ok: false, error: BE_ERRORS.RATE_LIMITED, details });
      }

      // Send the new OTP via email
      if (result.otp && freshUser.email) {
        await emailService.sendOtp(freshUser.email, result.otp, freshUser.name);
      }

      return apiResponse({ ok: true, data: { message: 'Verification code sent' } });
    })
  )

  // ==================== VERIFICATION STATUS ====================
  .get('/verification-status', async ({ user, set, emailVerificationService }) => {
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;
    const { user: freshUser } = resolved;

    const status = await emailVerificationService.getVerificationStatus(freshUser.id);

    return apiResponse({
      ok: true,
      data: {
      email: status.email,
      emailVerified: status.emailVerified,
      pendingVerification: status.pendingVerification
    }});
  })

  // ==================== FORGOT PASSWORD ====================
  .group('', (app) =>
    app.use(authRecoveryRateLimiter).post(
      '/forgot-password',
      async ({ body, set, passwordResetService }) => {
        await passwordResetService.requestReset(body.email, body.phoneNumber);

        // Always return success to prevent user enumeration
        // The actual result is sent via email
        set.status = 200;
        return apiResponse({
          ok: true,
          data: {
          message:
            'If the email and phone number match our records, you will receive reset instructions.'
        }});
      },
      {
        body: t.Object({
          email: t.String({ format: 'email' }),
          phoneNumber: t.String({ minLength: 10 })
        })
      }
    )
  )

  // ==================== RESET PASSWORD WITH TOKEN ====================
  .group('', (app) =>
    app.use(authResetRateLimiter).post(
      '/reset-password',
      async ({ body, set, passwordResetService }) => {
        const resetResult = await passwordResetService.resetPasswordWithToken(
          body.email,
          body.token,
          body.newPassword
        );

        if (isFailureResult(resetResult)) {
          set.status = 400;
          return apiResponse({
            ok: false,
            error: GEN_ERRORS.INVALID_INPUT,
            details: resetResult.error
          });
        }

        return apiResponse({ ok: true, data: { message: 'Password has been reset successfully' } });
      },
      {
        body: t.Object({
          email: t.String({ format: 'email' }),
          token: t.String({ minLength: 32 }),
          newPassword: t.String({ minLength: configs.AUTH.PASSWORD_MIN_LENGTH })
        })
      }
    )
  )

  // ==================== FORCE CHANGE PASSWORD ====================
  .post(
    '/force-change-password',
    async ({ user, body, set, userService, passwordResetService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      // Only allow if user has mustChangePassword flag
      const result = await userService.getUserById(freshUser.id);
      if (isFailureResult(result) || !result.user?.mustChangePassword) {
        set.status = 403;
        return apiResponse({
          ok: false,
          error: GEN_ERRORS.FORBIDDEN,
          details: 'Password change not required'
        });
      }

      const resetResult = await passwordResetService.completeReset(freshUser.id, body.newPassword);

      if (isFailureResult(resetResult)) {
        set.status = 400;
        return apiResponse({
          ok: false,
          error: GEN_ERRORS.INVALID_INPUT,
          details: resetResult.error
        });
      }

      return apiResponse({ ok: true, data: { message: 'Password changed successfully' } });
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: configs.AUTH.PASSWORD_MIN_LENGTH })
      })
    }
  );
