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
 * IMPORTANT: These guards must be used AFTER sessionAuthPlugin
 * since they depend on the `user` context being set.
 */
import { Elysia } from 'elysia';
import type { AuthUser } from '@/types';

/**
 * Plugin that requires verified email to access routes.
 * Use this for features that should be blocked for unverified emails.
 *
 * MUST be used after sessionAuthPlugin which provides the `user` context.
 */
export const requireVerifiedEmail = new Elysia({ name: 'email-verified-guard' }).derive(
  ({ store, set }) => {
    // Access user from store since it's set by sessionAuthPlugin
    const user = (store as { user?: AuthUser }).user;

    if (!user) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    if (!user.emailVerified) {
      set.status = 403;
      throw new Error('Email verification required to access this feature');
    }

    return {};
  }
);

/**
 * Plugin that warns about unverified email but doesn't block.
 * Use this for features like activity alerts where we show a banner.
 *
 * MUST be used after sessionAuthPlugin which provides the `user` context.
 */
export const warnUnverifiedEmail = new Elysia({ name: 'email-unverified-warn' }).derive(
  ({ store }) => {
    const user = (store as { user?: AuthUser }).user;

    return {
      emailVerificationWarning:
        user?.email && !user?.emailVerified
          ? 'Please verify your email to receive important notifications'
          : null
    };
  }
);

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
