import { Elysia, t, type Static } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { configs } from '@/config';
import { logger } from '@repo/logger';

/**
 * JWT Payload Schema
 * Defines the structure of data stored in the JWT token
 *
 * SECURITY NOTE: phoneNumber is included in JWT payload to prevent session tampering.
 * The JWT is signed with a secret key, making it cryptographically secure against modification.
 *
 * sessionVersion is included to enable instant token invalidation when:
 * - User changes password
 * - Admin forces logout of all sessions
 * - User explicitly revokes all devices
 *
 * iss (issuer) and aud (audience) are validated to prevent token reuse from other systems
 */
export const jwtPayloadSchema = t.Object({
  id: t.String({ description: 'User unique identifier from Database' }),
  phoneNumber: t.String({ description: 'User phone number (tamper-proof)' }),
  sessionVersion: t.Number({ description: 'Session version for instant invalidation' })
});

export type JWTPayload = Static<typeof jwtPayloadSchema>;

/**
 * JWT Plugin
 *
 * Provides JWT utilities to the context:
 * - jwt.sign(payload) - Create a new token
 * - jwt.verify(token) - Verify and decode a token
 * - bearer - Extracted Bearer token from Authorization header
 *
 * Note: This plugin does NOT set the user. Use sessionAuth for full authentication.
 */
export const jwtAuth = new Elysia({ name: 'JWT_Auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: configs.AUTH.JWT_SECRET,
      schema: jwtPayloadSchema,
      exp: '15m', // Shorter for access tokens
      iss: 'buddy-wallet-api',
      aud: 'buddy-wallet-web'
    })
  )
  .use(bearer())
  .onStart(() => {
    logger.jwt('JWT plugin initialized');
  });

/**
 * JWT Refresh Plugin
 *
 * Separate JWT plugin for refresh tokens using a distinct secret.
 * This ensures refresh tokens cannot be used as access tokens and vice versa.
 */
export const jwtRefreshAuth = new Elysia({ name: 'JWT_Refresh_Auth' })
  .use(
    jwt({
      name: 'jwtRefresh',
      secret: configs.AUTH.JWT_REFRESH_SECRET,
      schema: jwtPayloadSchema,
      exp: '90d',
      iss: 'buddy-wallet-api',
      aud: 'buddy-wallet-web'
    })
  )
  .use(bearer())
  .onStart(() => {
    logger.jwt('JWT Refresh plugin initialized');
  });
