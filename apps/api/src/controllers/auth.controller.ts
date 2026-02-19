/**
 * Auth Controller
 *
 * Thin controller that delegates to authService and sessionService.
 * Handles HTTP concerns (cookies, headers, status codes) only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { sessionAuthPlugin } from '../plugins/auth';
import { authRateLimiter } from '../plugins/middleware';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '../plugins/redis';
import { configs } from '../configs';
import {
  AuthService,
  SessionService,
  ActivityService,
  EmailVerificationService,
  EmailService,
  PasswordResetService,
  UserService
} from '../services';
import { getClientIP, hashToken } from '../utils';

export const AuthController = new Elysia({ prefix: '/auth' })
  .use(sessionAuthPlugin)
  .use(authRateLimiter) // Rate limit: 10 requests per minute

  // ==================== REGISTER ====================
  .post(
    '/register',
    async ({ body, set }) => {
      const result = await AuthService.register(body);

      if (!result.success) {
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
    async ({ body, jwt, cookie, set, request }) => {
      const userAgent = request.headers.get('user-agent');
      const clientIP = getClientIP(request) || request.headers.get('x-forwarded-for');

      const result = await AuthService.login(
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
      await ActivityService.log({
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
  .post('/refresh', async ({ jwt, cookie, set, request }) => {
    const refreshToken = cookie.refresh_token.value as string;

    const result = await SessionService.refreshSession(refreshToken, jwt, {
      userAgent: request.headers.get('user-agent'),
      clientIP: getClientIP(request)
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
    return successResponse({ user });
  })

  // ==================== LOGOUT ====================
  .post('/logout', async ({ user, cookie, set, request }) => {
    const refreshToken = cookie.refresh_token.value as string;
    const accessToken = cookie.session.value as string;

    // Security: Require at least one valid token
    if (!refreshToken && !accessToken) {
      set.status = 401;
      return errorResponse(BE_ERRORS.AUTH_NO_SESSION);
    }

    if (refreshToken) {
      const result = await AuthService.logout(refreshToken, user?.id);
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
      await ActivityService.log({
        userId: user.id,
        action: 'logout',
        resource: 'session',
        ipAddress: getClientIP(request) || undefined,
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
  .post('/logout-all', async ({ user, cookie, set, request }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    await SessionService.revokeAllSessions(user.id);

    // Log the logout-all activity
    await ActivityService.log({
      userId: user.id,
      action: 'logout_all',
      resource: 'session',
      ipAddress: getClientIP(request) || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    // Clear current session cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return successResponse({ message: 'All sessions have been logged out' });
  })

  // ==================== LIST SESSIONS ====================
  .get('/sessions', async ({ user, cookie, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const refreshToken = cookie.refresh_token.value as string;
    const result = await SessionService.getUserSessions(user.id, refreshToken);

    return successResponse(result);
  })

  // ==================== REVOKE SESSION ====================
  .post(
    '/sessions/:sessionId/revoke',
    async ({ user, params, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const refreshToken = cookie.refresh_token.value as string;
      const result = await SessionService.revokeSession(params.sessionId, user.id, refreshToken);

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
    async ({ user, body, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      // Get current session ID
      let currentSessionId: string | null = null;
      const refreshToken = cookie.refresh_token.value as string;
      if (refreshToken) {
        await hashToken(refreshToken);
        const { sessions } = await SessionService.getUserSessions(user.id);
        // Find matching session (simplified)
        currentSessionId = sessions[0]?.id || null;
      }

      const result = await AuthService.changePassword(
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
    async ({ body, set }) => {
      const result = await EmailVerificationService.verifyOtp(body.email, body.otp);

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
  .post('/resend-otp', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const result = await EmailVerificationService.resendOtp(user.id);

    if (!result.success) {
      set.status = 429; // Too Many Requests
      const details = result.retryAfter
        ? `${result.error} Retry after ${result.retryAfter} seconds.`
        : result.error;
      return errorResponse(BE_ERRORS.RATE_LIMITED, details);
    }

    // Send the new OTP via email
    if (result.otp && user.email) {
      await EmailService.sendOtp(user.email, result.otp, user.name);
    }

    return successResponse({ message: 'Verification code sent' });
  })

  // ==================== VERIFICATION STATUS ====================
  .get('/verification-status', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const status = await EmailVerificationService.getVerificationStatus(user.id);

    return successResponse({
      email: status.email,
      emailVerified: status.emailVerified,
      pendingVerification: status.pendingVerification
    });
  })

  // ==================== FORGOT PASSWORD ====================
  .post(
    '/forgot-password',
    async ({ body, set }) => {
      const result = await PasswordResetService.requestReset(body.email, body.phoneNumber);

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

  // ==================== FORCE CHANGE PASSWORD ====================
  .post(
    '/force-change-password',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      // Only allow if user has mustChangePassword flag
      const result = await UserService.getUserById(user.id);
      if (!result.success || !result.user?.mustChangePassword) {
        set.status = 403;
        return errorResponse(GEN_ERRORS.FORBIDDEN, 'Password change not required');
      }

      const resetResult = await PasswordResetService.completeReset(user.id, body.newPassword);

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
