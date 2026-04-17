import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { RegisterSchema, LoginSchema } from '@repo/schema';
import { GEN_ERRORS, BE_ERRORS, apiSuccess, apiError } from '@repo/errors';
import { sessionAuthPlugin } from '@/lib/plugins/auth';
import {
  authIdentifierRateLimiter,
  authOtpRateLimiter,
  authRateLimiter,
  authRecoveryRateLimiter,
  authResetRateLimiter
} from '@/lib/plugins/middleware';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@/lib/redis';
import { configs } from '@/configs';
import { hashToken, toSafeUser } from '@lib/security/password';
import { getClientIP } from '@lib/http/ip';

import { respondFailure, isFailureResult } from '@/lib/http';
import { resolveActor } from '@/lib/http';
import {
  AUTH_REGISTER_ERROR_MAP,
  DEFAULT_AUTH_REGISTER_FAILURE
} from '@/lib/http/error-maps';
import { AuthService } from '@/app/Services/AuthService';
import { AuthSecurityService } from '@/app/Services/AuthSecurityService';
import { AuthSessionService } from '@/app/Services/AuthSessionService';
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
import { PasswordResetService } from '@/app/Services/PasswordResetService';

@injectable()
export class AuthController {
  constructor(
    @inject(AuthService) private authService: AuthService,
    @inject(AuthSecurityService) private authSecurityService: AuthSecurityService,
    @inject(AuthSessionService) private authSessionService: AuthSessionService,
    @inject(EmailVerificationService) private emailVerificationService: EmailVerificationService,
    @inject(PasswordResetService) private passwordResetService: PasswordResetService
  ) {}

  register(app: Elysia): Elysia {
    return app.use(sessionAuthPlugin).group('/auth', (group) =>
      group
        .use(authRateLimiter)

        // ==================== REGISTER ====================
        .post(
          '/register',
          async ({ body, set }) => {
            const result = await this.authService.register(body);

            if (isFailureResult(result)) {
              if (result.code === 'DATABASE_ERROR') {
                set.status = 503;
                set.headers['Retry-After'] = '30';
                return apiError(BE_ERRORS.DB_CONNECTION, 'Service unavailable. Please try again later.');
              }

              return respondFailure(set, result, {
                map: AUTH_REGISTER_ERROR_MAP,
                fallback: DEFAULT_AUTH_REGISTER_FAILURE
              });
            }

            set.status = 200;
            return apiSuccess({ user: result.data.user });
          },
          {
            body: RegisterSchema
          }
        )

        // ==================== LOGIN ====================
        .group('', (app) =>
          app.use(authIdentifierRateLimiter).post(
            '/login',
            async ({ body, jwt, cookie, set, request, server }) => {
              const userAgent = request.headers.get('user-agent') || undefined;
              const clientIP = getClientIP(request, server);

              const result = await this.authSecurityService.login(
                {
                  identifier: body.email,
                  password: body.password,
                  userAgent,
                  clientIP
                },
                jwt
              );

              if (isFailureResult(result)) {
                if (result.code === 'DATABASE_ERROR') {
                  set.status = 503;
                  set.headers['Retry-After'] = '30';
                  return apiError(BE_ERRORS.DB_CONNECTION, 'Service unavailable. Please try again later.');
                }

                set.status = 401;
                return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS, result.error);
              }

              const authData = result.data;

              // Set access token cookie (short-lived)
              cookie.session.set({
                value: authData.accessToken,
                httpOnly: true,
                secure: configs.APP.IS_PRODUCTION,
                sameSite: 'lax',
                path: '/',
                maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
              });

              // Set refresh token cookie (long-lived)
              cookie.refresh_token.set({
                value: authData.refreshToken,
                httpOnly: true,
                secure: configs.APP.IS_PRODUCTION,
                sameSite: 'lax',
                path: '/',
                maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000
              });

              set.status = 200;
              return apiSuccess({
                user: authData.user,
                expiresIn: authData.expiresIn,
                mustChangePassword: authData.mustChangePassword
              });
            },
            {
              body: LoginSchema
            }
          )
        )

        // ==================== REFRESH ====================
        .post('/refresh', async ({ jwt, cookie, set, request, server }) => {
          const refreshToken = cookie.refresh_token.value;

          if (!refreshToken) {
            set.status = 401;
            return apiError(BE_ERRORS.AUTH_NO_SESSION);
          }

          const result = await this.authSecurityService.refreshSession(refreshToken, jwt, {
            userAgent: request.headers.get('user-agent') || undefined,
            clientIP: getClientIP(request, server)
          });

          if (isFailureResult(result)) {
            cookie.session.remove();
            cookie.refresh_token.remove();
            set.status = 401;
            return apiError(BE_ERRORS.AUTH_SESSION_EXPIRED, result.error);
          }

          const authData = result.data;

          // Set new access token cookie
          cookie.session.set({
            value: authData.accessToken,
            httpOnly: true,
            secure: configs.APP.IS_PRODUCTION,
            sameSite: 'lax',
            path: '/',
            maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
          });

          // REFRESH TOKEN ROTATION: Set new refresh token cookie
          if (authData.refreshToken) {
            cookie.refresh_token.set({
              value: authData.refreshToken,
              httpOnly: true,
              secure: configs.APP.IS_PRODUCTION,
              sameSite: 'lax',
              path: '/',
              maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000
            });
          }

          set.status = 200;
          return apiSuccess({
            user: authData.user,
            expiresIn: authData.expiresIn
          });
        })

        // ==================== ME ====================
        .use(sessionAuthPlugin)
        .get('/me', async ({ user, set }) => {
          const resolved = await resolveActor(user, set);
          if (!resolved.ok) return resolved.error;
          
          return apiSuccess({ user: toSafeUser(resolved.user) });
        })

        // ==================== LOGOUT ====================
        .post('/logout', async ({ user, cookie, set }) => {
          const refreshToken = cookie.refresh_token.value;
          const accessToken = cookie.session.value;

          // Security: Require at least one valid token
          if (!refreshToken && !accessToken) {
            set.status = 401;
            return apiError(BE_ERRORS.AUTH_NO_SESSION);
          }

          if (refreshToken) {
            const result = await this.authSessionService.logout(refreshToken, user?.id);
            if (isFailureResult(result)) {
              set.status = 403;
              return apiError(GEN_ERRORS.FORBIDDEN, result.error);
            }

            // Blacklist the access token
            if (isRedisAvailable() && accessToken) {
              const tokenHash = await hashToken(accessToken); // SECURITY: Hash before blacklisting
              await sessionCache.del(tokenHash);
              await jwtBlacklist.add(tokenHash, configs.AUTH.JWT_BLACKLIST_SECONDS);
            }
          }

          // Clear both cookies
          cookie.session.remove();
          cookie.refresh_token.remove();

          set.status = 200;
          return apiSuccess({ message: 'Logged out successfully' });
        })

        // ==================== CHANGE PASSWORD ====================
        .post(
          '/change-password',
          async ({ user, body, cookie, set }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const result = await this.authSessionService.changePassword(
              freshUser.id,
              body.currentPassword,
              body.newPassword,
              undefined // currentSessionId lookup removed for simplicity in first pass
            );

            if (isFailureResult(result)) {
              set.status = 400;
              return apiError(BE_ERRORS.AUTH_PASSWORD_MISMATCH, result.error);
            }

            return apiSuccess({
              message: 'Password changed successfully. Other sessions have been logged out.'
            });
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
            async ({ body, set }) => {
              const result = await this.emailVerificationService.verifyOtp(body.userId, body.email, body.otp);

              if (isFailureResult(result)) {
                set.status = 400;
                return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
              }

              return apiSuccess({ message: 'Email verified successfully' });
            },
            {
              body: t.Object({
                userId: t.String(),
                email: t.String({ format: 'email' }),
                otp: t.String({ minLength: 6, maxLength: 6 })
              })
            }
          )
        )

        // ==================== RESEND OTP ====================
        .group('', (app) =>
          app.use(authOtpRateLimiter).post('/resend-otp', async ({ user, set }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const result = await this.emailVerificationService.resendOtp(freshUser.id);

            if (isFailureResult(result)) {
              set.status = 429;
              return apiError(BE_ERRORS.RATE_LIMITED, result.error);
            }

            return apiSuccess({ message: 'Verification code sent' });
          })
        )

        // ==================== VERIFICATION STATUS ====================
        .get('/verification-status', async ({ user, set }) => {
          const resolved = await resolveActor(user, set);
          if (!resolved.ok) return resolved.error;
          const { user: freshUser } = resolved;

          const status = await this.emailVerificationService.getVerificationStatus(freshUser.id);

          if (!status) {
            set.status = 404;
            return apiError(GEN_ERRORS.NOT_FOUND);
          }

          return apiSuccess({
            email: status.email,
            emailVerified: status.emailVerified,
            pendingVerification: status.pendingVerification
          });
        })
        
        // ==================== FORGOT PASSWORD ====================
        .group('', (app) =>
          app.use(authRecoveryRateLimiter).post(
            '/forgot-password',
            async ({ body, set }) => {
              const result = await this.passwordResetService.requestReset(body.email, body.phoneNumber);

              if (isFailureResult(result)) {
                set.status = 400;
                return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
              }

              return apiSuccess({
                message: 'If the email and phone number match our records, you will receive reset instructions shortly.'
              });
            },
            {
              body: t.Object({
                email: t.String({ format: 'email' }),
                phoneNumber: t.String({ minLength: 10 })
              })
            }
          )
        )

        // ==================== RESET PASSWORD ====================
        .group('', (app) =>
          app.use(authResetRateLimiter).post(
            '/reset-password',
            async ({ body, set }) => {
              const result = await this.passwordResetService.resetPasswordWithToken(
                body.email,
                body.token,
                body.password
              );

              if (isFailureResult(result)) {
                set.status = 400;
                return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
              }

              return apiSuccess({ message: 'Password reset successful. Please login with your new password.' });
            },
            {
              body: t.Object({
                email: t.String({ format: 'email' }),
                token: t.String(),
                password: t.String({ minLength: configs.AUTH.PASSWORD_MIN_LENGTH })
              })
            }
          )
        )
    );
  }
}

