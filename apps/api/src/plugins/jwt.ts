import { Elysia, t, type Static } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { configs } from '@/configs';
import { logger } from '@utils/logger';

/**
 * JWT Payload Schema
 * Defines the structure of data stored in the JWT token
 */
export const jwtPayloadSchema = t.Object({
  id: t.String({ description: 'User unique identifier from Database' }),
  iat: t.Optional(t.Number()), // Issued at
  exp: t.Optional(t.Number()) // Expiration time
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
 * Note: This plugin does NOT set the user. Use sessionAuthPlugin for full authentication.
 */
export const jwtPlugin = new Elysia({ name: 'JWT_Plugin' })
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
