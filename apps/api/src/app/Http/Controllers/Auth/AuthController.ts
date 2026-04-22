import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { RegisterSchema, LoginSchema } from '@repo/schema';
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { actor } from '@/app/Providers/Plugins';
import {
  authIdentifierRateLimiter,
  authOtpRateLimiter,
  authRateLimiter,
  authRecoveryRateLimiter,
  authResetRateLimiter
} from '@/app/Http/Middlewares';
import { sessionCache, jwtBlacklist, isRedisAvailable } from '@infra/Redis';
import { appConfig, authConfig } from '@/config';
import { hashToken } from '@/lib/security/password';
import { getClientIP } from '@/lib/http/ip';

import { apiSuccess, apiError, isFailureResult } from '@/lib/http';
import { toUserResponse } from '@/app/Http/Mappers/UserMapper';
import { RegisterAction } from '@/app/Actions/Auth/RegisterAction';
import { LoginAction } from '@/app/Actions/Auth/LoginAction';
import { LogoutAction } from '@/app/Actions/Auth/LogoutAction';
import { ChangePasswordAction } from '@/app/Actions/Auth/ChangePasswordAction';
import { RefreshSessionAction } from '@/app/Actions/Auth/RefreshSessionAction';
import { VerifyOtpAction } from '@/app/Actions/Auth/VerifyOtpAction';
import { ResendOtpAction } from '@/app/Actions/Auth/ResendOtpAction';
import { GetVerificationStatusAction } from '@/app/Actions/Auth/GetVerificationStatusAction';
import { RequestResetAction } from '@/app/Actions/Auth/RequestResetAction';
import { ResetPasswordWithTokenAction } from '@/app/Actions/Auth/ResetPasswordWithTokenAction';
import type { AuthenticatedElysiaContext } from '@/types/elysia';
import type { SafeUser } from '@repo/types';

/**
 * AuthController - HTTP API endpoints for authentication
 */
@injectable()
export class AuthController {
  constructor(
    @inject(RegisterAction) private registerAction: RegisterAction,
    @inject(LoginAction) private loginAction: LoginAction,
    @inject(LogoutAction) private logoutAction: LogoutAction,
    @inject(ChangePasswordAction) private changePasswordAction: ChangePasswordAction,
    @inject(RefreshSessionAction) private refreshSessionAction: RefreshSessionAction,
    @inject(VerifyOtpAction) private verifyOtpAction: VerifyOtpAction,
    @inject(ResendOtpAction) private resendOtpAction: ResendOtpAction,
    @inject(GetVerificationStatusAction) private getVerificationStatusAction: GetVerificationStatusAction,
    @inject(RequestResetAction) private requestResetAction: RequestResetAction,
    @inject(ResetPasswordWithTokenAction) private resetPasswordWithTokenAction: ResetPasswordWithTokenAction
  ) {}

  register(app: Elysia): any {
    return app.use(actor).group('/auth', (group) =>
      group
        .use(authRateLimiter)

        // ==================== REGISTER ====================
        .post('/register', async (ctx: any) => {
            const { body, set } = ctx as AuthenticatedElysiaContext<any>;
            const result = await this.registerAction.execute(body);

            if (isFailureResult(result)) {
              if (result.code === 'DATABASE_ERROR') {
                set.status = 503;
                return apiError(BE_ERRORS.DB_CONNECTION);
              }

              if (result.code === 'PHONE_EXISTS') set.status = 409;
              else if (result.code === 'EMAIL_EXISTS') set.status = 409;
              else if (result.code === 'INVALID_PASSWORD') set.status = 400;
              else set.status = 400;

              return apiError({ code: result.code, message: result.error || 'Registration failed' });
            }

            set.status = 200;
            return apiSuccess({ user: toUserResponse(result.data.user as SafeUser) });
          },
          {
            body: RegisterSchema
          }
        )

        // ==================== LOGIN ====================
        .group('', (loginGroup) =>
          loginGroup.use(authIdentifierRateLimiter).post(
            '/login',
            async (ctx: any) => {
              const { body, jwt, cookie, set, request, server } = ctx as AuthenticatedElysiaContext<any>;
              const result = await this.loginAction.execute({
                identifier: body.email,
                password: body.password,
                userAgent: request.headers.get('user-agent') || undefined,
                clientIP: (getClientIP(request, server) as string) || undefined
              }, jwt);

              if (isFailureResult(result)) {
                if (result.code === 'ACCOUNT_LOCKED') {
                  set.status = 423;
                  return apiError({ code: result.code, message: result.error || 'Account is locked' });
                }
                
                if (result.code === 'INVALID_CREDENTIALS') {
                  set.status = 401;
                  return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
                }

                if (result.code === 'DATABASE_ERROR') {
                  set.status = 503;
                  return apiError(BE_ERRORS.DB_CONNECTION);
                }

                set.status = 401;
                return apiError({ code: result.code, message: result.error || 'Login failed' });
              }

              const authData = result.data;

              cookie.session.set({
                value: authData.accessToken,
                httpOnly: true,
                secure: appConfig.IS_PRODUCTION,
                sameSite: 'lax',
                maxAge: authConfig.ACCESS_TOKEN_LIFETIME / 1000,
                path: '/'
              });

              cookie.refresh_token.set({
                value: authData.refreshToken,
                httpOnly: true,
                secure: appConfig.IS_PRODUCTION,
                sameSite: 'lax',
                maxAge: authConfig.REFRESH_TOKEN_LIFETIME / 1000,
                path: '/auth/refresh'
              });

              set.status = 200;
              return apiSuccess({
                user: toUserResponse(authData.user as SafeUser),
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
        .post('/refresh', async (ctx: any) => {
          const { jwt, cookie, set, request, server } = ctx as AuthenticatedElysiaContext;
          const refreshToken = cookie.refresh_token.value;

          if (!refreshToken) {
            set.status = 401;
            return apiError(BE_ERRORS.AUTH_NO_SESSION);
          }

          const result = await this.refreshSessionAction.execute(refreshToken as string, jwt as any, {
            userAgent: request.headers.get('user-agent'),
            clientIP: getClientIP(request, server)
          });

          if (isFailureResult(result)) {
            cookie.session.remove();
            cookie.refresh_token.remove();
            set.status = 401;
            return apiError(BE_ERRORS.AUTH_SESSION_EXPIRED, result.error);
          }

          const authData = result.data;

          cookie.session.set({
            value: authData.accessToken,
            httpOnly: true,
            secure: appConfig.IS_PRODUCTION,
            sameSite: 'lax',
            path: '/',
            maxAge: authConfig.ACCESS_TOKEN_LIFETIME / 1000
          });

          if (authData.refreshToken) {
            cookie.refresh_token.set({
              value: authData.refreshToken,
              httpOnly: true,
              secure: appConfig.IS_PRODUCTION,
              sameSite: 'lax',
              path: '/',
              maxAge: authConfig.REFRESH_TOKEN_LIFETIME / 1000
            });
          }

          set.status = 200;
          return apiSuccess({
            user: toUserResponse(authData.user as SafeUser),
            expiresIn: authData.expiresIn
          });
        })

        // ==================== ME ====================
        // @ts-expect-error macro
        .requireActor(true)
        .get('/me', async (ctx: any) => {
          const { actor } = ctx as AuthenticatedElysiaContext;
          return apiSuccess({ actor: toUserResponse(actor!) });
        })

        // ==================== LOGOUT ====================
        .post('/logout', async (ctx: any) => {
          const { actor, cookie, set } = ctx as AuthenticatedElysiaContext;
          const refreshToken = cookie.refresh_token.value;
          const accessToken = cookie.session.value;

          if (!refreshToken && !accessToken) {
            set.status = 401;
            return apiError(BE_ERRORS.AUTH_NO_SESSION);
          }

          if (refreshToken) {
            const result = await this.logoutAction.execute(refreshToken as string, actor?.id);
            if (isFailureResult(result)) {
              set.status = 403;
              return apiError(GEN_ERRORS.FORBIDDEN, result.error);
            }

            if (isRedisAvailable() && accessToken) {
              const tokenHash = await hashToken(accessToken as string);
              await sessionCache.del(tokenHash);
              await jwtBlacklist.add(tokenHash, authConfig.JWT_BLACKLIST_SECONDS);
            }
          }

          cookie.session.remove();
          cookie.refresh_token.remove();

          set.status = 200;
          return apiSuccess({ message: 'Logged out successfully' });
        })

        // ==================== CHANGE PASSWORD ====================
        .post(
          '/change-password',
          async (ctx: any) => {
            const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
            const result = await this.changePasswordAction.execute(
              actor!.id,
              body.currentPassword,
              body.newPassword,
              undefined
            );

            if (isFailureResult(result)) {
              set.status = 400;
              return apiError(BE_ERRORS.AUTH_PASSWORD_MISMATCH, result.error);
            }

            set.status = 200;
            return apiSuccess({
              message: 'Password changed successfully. Other sessions have been logged out.'
            });
          },
          {
            body: t.Object({
              currentPassword: t.String({ minLength: 1 }),
              newPassword: t.String({ minLength: authConfig.PASSWORD_MIN_LENGTH })
            })
          }
        )

        // ==================== VERIFY OTP ====================
        .group('', (otpGroup: any) =>
          otpGroup.use(authOtpRateLimiter).post(
            '/verify-otp',
            async (ctx: any) => {
              const { body, set } = ctx as AuthenticatedElysiaContext<any>;
              const result = await this.verifyOtpAction.execute(
                body.email,
                body.otp
              );

              if (isFailureResult(result)) {
                set.status = 400;
                return apiError({ code: result.code, message: result.error || 'Invalid OTP' });
              }

              set.status = 200;
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
        .group('', (otpGroup: any) =>
          otpGroup.use(authOtpRateLimiter).post('/resend-otp', async (ctx: any) => {
            const { actor, set } = ctx as AuthenticatedElysiaContext;
            const result = await this.resendOtpAction.execute(actor!.id);

            if (isFailureResult(result)) {
              set.status = 429;
              return apiError(BE_ERRORS.RATE_LIMITED, result.error);
            }

            set.status = 200;
            return apiSuccess({ message: 'Verification code sent' });
          })
        )

        // ==================== VERIFICATION STATUS ====================
        .get('/verification-status', async (ctx: any) => {
          const { actor, set } = ctx as AuthenticatedElysiaContext;
          const status = await this.getVerificationStatusAction.execute(actor!.id);

          if (!status) {
            set.status = 404;
            return apiError(GEN_ERRORS.NOT_FOUND);
          }

          set.status = 200;
          return apiSuccess({
            email: status.email,
            emailVerified: status.emailVerified,
            pendingVerification: status.pendingVerification
          });
        })

        // ==================== FORGOT PASSWORD ====================
        .group('', (forgotGroup: any) =>
          forgotGroup.use(authRecoveryRateLimiter).post(
            '/forgot-password',
            async (ctx: any) => {
              const { body, set } = ctx as AuthenticatedElysiaContext<any>;
              const result = await this.requestResetAction.execute(
                body.email,
                body.phoneNumber
              );

              if (isFailureResult(result)) {
                set.status = 400;
                return apiError({ code: result.code, message: result.error || 'Invalid input' });
              }

              set.status = 200;
              return apiSuccess({
                message:
                  'If the email and phone number match our records, you will receive reset instructions shortly.'
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
        .group('', (resetGroup: any) =>
          resetGroup.use(authResetRateLimiter).post(
            '/reset-password',
            async (ctx: any) => {
              const { body, set } = ctx as AuthenticatedElysiaContext<any>;
              const result = await this.resetPasswordWithTokenAction.execute(
                body.email,
                body.token,
                body.password
              );

              if (isFailureResult(result)) {
                set.status = 400;
                return apiError({ code: result.code, message: result.error || 'Invalid token' });
              }

              set.status = 200;
              return apiSuccess({
                message: 'Password reset successful. Please login with your new password.'
              });
            },
            {
              body: t.Object({
                email: t.String({ format: 'email' }),
                token: t.String(),
                password: t.String({ minLength: authConfig.PASSWORD_MIN_LENGTH })
              })
            }
          )
        )
    );
  }
}

