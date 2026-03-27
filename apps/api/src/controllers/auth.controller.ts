/**
 * Auth Controller
 *
 * Thin controller that delegates to auth services via DI.
 * Handles HTTP concerns (cookies, headers, status codes) only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { sessionAuthPlugin } from '../plugins/auth';
import { authRateLimiter } from '../plugins/middleware';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '../plugins/redis';
import { configs } from '../configs';
import { getClientIP, hashToken } from '../utils';
import { servicesPlugin } from '../plugins/services.plugin';

export const AuthController = new Elysia({ prefix: '/auth' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(authRateLimiter) // Rate limit: 10 requests per minute

  // ==================== REGISTER ====================
  .post(
    '/register',
    async ({ body, set, authCoreService }) => {
      const result = await authCoreService.register(body);

      if (!result.success) {
        if (result.error === 'DATABASE_ERROR') {
          set.status = 503;
          set.headers['Retry-After'] = '30';
          return errorResponse(
            BE_ERRORS.DB_CONNECTION,
            'Service unavailable. Please try again later.'
          );
        }

        set.status = 400;
        // Map service errors to standardized error codes
        const errorMap: Record<string, (typeof BE_ERRORS)[keyof typeof BE_ERRORS]> = {
          'Invalid phone number format': BE_ERRORS.AUTH_INVALID_PHONE,
          'Phone number already registered': BE_ERRORS.AUTH_PHONE_EXISTS,
          'Email already registered': BE_ERRORS.AUTH_EMAIL_EXISTS
        };
        const error = errorMap[result.error!] || GEN_ERRORS.INVALID_INPUT;
        return errorResponse(error, result.error);
      }

      set.status = 200;
      return successResponse({ user: result.user });
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

      if (!result.success) {
        if (result.error === 'DATABASE_ERROR') {
          set.status = 503;
          set.headers['Retry-After'] = '30';
          return errorResponse(
            BE_ERRORS.DB_CONNECTION,
            'Service unavailable. Please try again later.'
          );
        }

        set.status = 401;
        return errorResponse(BE_ERRORS.AUTH_INVALID_CREDENTIALS, result.error);
      }

      // Set access token cookie (short-lived)
      cookie.session.set({
        value: result.accessToken!,
        httpOnly: true,
        secure: !configs.APP.IS_DEV,
        sameSite: 'lax',
        path: '/',
        maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
      });

      // Set refresh token cookie (long-lived)
      cookie.refresh_token.set({
        value: result.refreshToken!,
        httpOnly: true,
        secure: !configs.APP.IS_DEV,
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
      return successResponse({
        user: result.user,
        expiresIn: result.expiresIn,
        mustChangePassword: result.mustChangePassword
      });
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    }
  )

  // ==================== REFRESH ====================
  .post('/refresh', async ({ jwt, cookie, set, request, server, sessionService }) => {
    const refreshToken = cookie.refresh_token.value as string;

    const result = await sessionService.refreshSession(refreshToken, jwt, {
      userAgent: request.headers.get('user-agent'),
      clientIP: getClientIP(request, server)
    });

    if (!result.success) {
      cookie.session.remove();
      cookie.refresh_token.remove();
      set.status = 401;
      return errorResponse(BE_ERRORS.AUTH_SESSION_EXPIRED, result.error);
    }

    // Set new access token cookie
    cookie.session.set({
      value: result.accessToken!,
      httpOnly: true,
      secure: !configs.APP.IS_DEV,
      sameSite: 'lax',
      path: '/',
      maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
    });

    // REFRESH TOKEN ROTATION: Set new refresh token cookie
    if (result.refreshToken) {
      cookie.refresh_token.set({
        value: result.refreshToken,
        httpOnly: true,
        secure: !configs.APP.IS_DEV,
        sameSite: 'lax',
        path: '/',
        maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000
      });
    }

    set.status = 200;
    return successResponse({
      user: result.user,
      expiresIn: result.expiresIn
    });
  })

  // ==================== ME ====================
  .get('/me', async ({ user }) => {
    return successResponse({
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            permissions: user.permissions || [],
            isActive: user.isActive,
            emailVerified: user.emailVerified,
            emailNotificationsEnabled: user.emailNotificationsEnabled,
            pushNotificationsEnabled: user.pushNotificationsEnabled,
            mustChangePassword: user.mustChangePassword,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        : null
    });
  })

  // ==================== LOGOUT ====================
  .post('/logout', async ({ user, cookie, set, request, server, authSessionService, activityService }) => {
    const refreshToken = cookie.refresh_token.value as string;
    const accessToken = cookie.session.value as string;

    // Security: Require at least one valid token
    if (!refreshToken && !accessToken) {
      set.status = 401;
      return errorResponse(BE_ERRORS.AUTH_NO_SESSION);
    }

    if (refreshToken) {
      const result = await authSessionService.logout(refreshToken, user?.id);
      if (!result.success) {
        set.status = 403;
        return errorResponse(GEN_ERRORS.FORBIDDEN, result.error);
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
    return successResponse();
  })

  // ==================== LOGOUT ALL ====================
  .post('/logout-all', async ({ user, cookie, set, request, server, sessionService, activityService }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    await sessionService.revokeAllSessions(user.id);

    // Log the logout-all activity
    await activityService.log({
      userId: user.id,
      action: 'logout_all',
      resource: 'session',
      ipAddress: getClientIP(request, server) || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    // Clear current session cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return successResponse({ message: 'All sessions have been logged out' });
  })

  // ==================== LIST SESSIONS ====================
  .get('/sessions', async ({ user, cookie, set, sessionService }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const refreshToken = cookie.refresh_token.value as string;
    const result = await sessionService.getUserSessions(user.id, refreshToken);

    return successResponse(result);
  })

  // ==================== REVOKE SESSION ====================
  .post(
    '/sessions/:sessionId/revoke',
    async ({ user, params, cookie, set, sessionService }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const refreshToken = cookie.refresh_token.value as string;
      const result = await sessionService.revokeSession(params.sessionId, user.id, refreshToken);

      if (!result.success) {
        set.status = 404;
        return errorResponse(GEN_ERRORS.NOT_FOUND, result.error);
      }

      // If user revoked their current session, clear cookies
      if (result.isCurrent) {
        cookie.session.remove();
        cookie.refresh_token.remove();
      }

      return successResponse({ message: 'Session revoked' });
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
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      // Get current session ID
      let currentSessionId: string | null = null;
      const refreshToken = cookie.refresh_token.value as string;
      if (refreshToken) {
        await hashToken(refreshToken);
        const { sessions } = await sessionService.getUserSessions(user.id);
        // Find matching session (simplified)
        currentSessionId = sessions[0]?.id || null;
      }

      const result = await authSessionService.changePassword(
        user.id,
        body.currentPassword,
        body.newPassword,
        currentSessionId || undefined
      );

      if (!result.success) {
        set.status = 400;
        return errorResponse(BE_ERRORS.AUTH_PASSWORD_MISMATCH, result.error);
      }

      return successResponse({
        message: 'Password changed successfully. Other sessions have been logged out.'
      });
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: configs.AUTH.MIN_PASSWORD_LENGTH })
      })
    }
  )

  // ==================== VERIFY OTP ====================
  .post(
    '/verify-otp',
    async ({ body, set, emailVerificationService }) => {
      const result = await emailVerificationService.verifyOtp(body.email, body.otp);

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ message: 'Email verified successfully' });
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        otp: t.String({ minLength: 6, maxLength: 6 })
      })
    }
  )

  // ==================== RESEND OTP ====================
  .post('/resend-otp', async ({ user, set, emailVerificationService, emailService }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const result = await emailVerificationService.resendOtp(user.id);

    if (!result.success) {
      set.status = 429; // Too Many Requests
      const details = result.retryAfter
        ? `${result.error} Retry after ${result.retryAfter} seconds.`
        : result.error;
      return errorResponse(BE_ERRORS.RATE_LIMITED, details);
    }

    // Send the new OTP via email
    if (result.otp && user.email) {
      await emailService.sendOtp(user.email, result.otp, user.name);
    }

    return successResponse({ message: 'Verification code sent' });
  })

  // ==================== VERIFICATION STATUS ====================
  .get('/verification-status', async ({ user, set, emailVerificationService }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const status = await emailVerificationService.getVerificationStatus(user.id);

    return successResponse({
      email: status.email,
      emailVerified: status.emailVerified,
      pendingVerification: status.pendingVerification
    });
  })

  // ==================== FORGOT PASSWORD ====================
  .post(
    '/forgot-password',
    async ({ body, set, passwordResetService }) => {
      await passwordResetService.requestReset(body.email, body.phoneNumber);

      // Always return success to prevent user enumeration
      // The actual result is sent via email
      set.status = 200;
      return successResponse({
        message:
          'If the email and phone number match our records, you will receive reset instructions.'
      });
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        phoneNumber: t.String({ minLength: 10 })
      })
    }
  )

  // ==================== RESET PASSWORD WITH TOKEN ====================
  .post(
    '/reset-password',
    async ({ body, set, passwordResetService }) => {
      const resetResult = await passwordResetService.resetPasswordWithToken(
        body.email,
        body.token,
        body.newPassword
      );

      if (!resetResult.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, resetResult.error);
      }

      return successResponse({ message: 'Password has been reset successfully' });
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        token: t.String({ minLength: 32 }),
        newPassword: t.String({ minLength: configs.AUTH.MIN_PASSWORD_LENGTH })
      })
    }
  )

  // ==================== FORCE CHANGE PASSWORD ====================
  .post(
    '/force-change-password',
    async ({ user, body, set, userService, passwordResetService }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      // Only allow if user has mustChangePassword flag
      const result = await userService.getUserById(user.id);
      if (!result.success || !result.user?.mustChangePassword) {
        set.status = 403;
        return errorResponse(GEN_ERRORS.FORBIDDEN, 'Password change not required');
      }

      const resetResult = await passwordResetService.completeReset(user.id, body.newPassword);

      if (!resetResult.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, resetResult.error);
      }

      return successResponse({ message: 'Password changed successfully' });
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: configs.AUTH.MIN_PASSWORD_LENGTH })
      })
    }
  );
