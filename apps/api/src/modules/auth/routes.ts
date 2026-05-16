/**
 * Auth Routes
 * @logicType http
 */

import { Elysia } from 'elysia';
import {
  authIdentifierRateLimiter,
  authRecoveryRateLimiter,
  authResetRateLimiter,
  authOtpRateLimiter
} from '@/commons/http/rate-limit.middleware';
import {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  LogoutSchema,
  VerifyEmailSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema
} from './schema';
import { register } from './handlers/register.handler';
import { session } from './handlers/login.handler';
import { password } from './handlers/password.handler';
import { jwtAuth, jwtRefreshAuth } from './plugins/jwt.plugin';
import { sessionsHandler } from './handlers/sessions.handler';
import { requireUser } from '@/commons/http/require-user';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .group('', (auth) =>
    auth
      .use(authIdentifierRateLimiter)
      .use(jwtAuth)
      .use(jwtRefreshAuth)
      .post('/register', register.handler, {
        body: RegisterSchema,
        detail: { tags: ['auth'], description: 'Register a new user' }
      })
      .post('/login', session.login, {
        body: LoginSchema,
        detail: { tags: ['auth'], description: 'Login with email/phone and password' }
      })
  )
  .post('/refresh', session.refresh, {
    body: RefreshTokenSchema,
    detail: { tags: ['auth'], description: 'Refresh access token' }
  })
  .post('/logout', session.logout, {
    body: LogoutSchema,
    detail: { tags: ['auth'], description: 'Logout from current or all devices' }
  })
  .get('/sessions', requireUser(sessionsHandler.list), {
    detail: { tags: ['auth'], description: 'List active sessions for current user' }
  })
  .delete('/sessions/:id', requireUser(sessionsHandler.revoke), {
    detail: { tags: ['auth'], description: 'Revoke a specific session' }
  })
  .group('', (auth) =>
    auth
      .use(authOtpRateLimiter)
      .post('/verify-email', password.verifyEmail, {
        body: VerifyEmailSchema,
        detail: { tags: ['auth'], description: 'Verify email with OTP' }
      })
  )
  .group('', (auth) =>
    auth
      .use(authRecoveryRateLimiter)
      .post('/request-password-reset', password.requestReset, {
        body: RequestPasswordResetSchema,
        detail: { tags: ['auth'], description: 'Request password reset link' }
      })
  )
  .group('', (auth) =>
    auth
      .use(authResetRateLimiter)
      .post('/reset-password', password.reset, {
        body: ResetPasswordSchema,
        detail: { tags: ['auth'], description: 'Reset password with token' }
      })
  );
