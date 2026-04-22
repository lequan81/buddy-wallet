/**
 * Email Verified Guard Plugin
 *
 * Elysia plugin that checks if user has verified their email
 * before allowing access to certain features.
 *
 * Features restricted for unverified emails:
 * - Debt notification emails
 * - 2FA code emails
 * - (Password reset has separate logic with phone verification)
 *
 * IMPORTANT: These guards must be used AFTER sessionAuth plugin
 * since they depend on the `user` context being set.
 */
import { Elysia } from 'elysia';
import { sessionAuth } from '../Authentication/SessionAuthPlugin';
import { GEN_ERRORS } from '@repo/errors';

/**
 * Plugin that requires verified email to access routes.
 * Use this for features that should be blocked for unverified emails.
 *
 * MUST be used after sessionAuth which provides the `user` context.
 */
export const requireVerifiedEmail = new Elysia({ name: 'Email_Verified_Guard' })
  .use(sessionAuth)
  .derive(({ user, set }) => {
    if (!user) {
      set.status = 401;
      throw new Error(GEN_ERRORS.UNAUTHORIZED.message);
    }

    if (!user.emailVerified) {
      set.status = 403;
      throw new Error('Email verification required to access this feature');
    }

    return {};
  });

/**
 * Plugin that warns about unverified email but doesn't block.
 * Use this for features like activity alerts where we show a banner.
 *
 * MUST be used after sessionAuth which provides the `user` context.
 */
export const warnUnverifiedEmail = new Elysia({ name: 'Email_Unverified_Warn' })
  .use(sessionAuth)
  .derive(({ user }) => {
    return {
      emailVerificationWarning:
        user?.email && !user?.emailVerified
          ? 'Please verify your email to receive important notifications'
          : null
    };
  });

/**
 * Helper to check if email features can be sent to user.
 * Returns false for users without verified email.
 */
export function canSendEmailFeature(user: {
  email?: string | null;
  emailVerified?: boolean;
}): boolean {
  return Boolean(user.email && user.emailVerified);
}
