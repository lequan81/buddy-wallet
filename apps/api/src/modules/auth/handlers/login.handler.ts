/**
 * Login and session handlers.
 * @logicType http
 */

import { randomUUIDv7 } from 'bun';
import { authConfig } from '@/config';
import { SHARED_CONSTANTS } from '@repo/config';
import { db } from '@/providers/database';
import { UserRepository } from '@/repositories/user/user.repo';
import { SessionRepository } from '@/repositories/auth/session.repo';
import { toUserResponse, hashPassword, hashToken, verifyPassword, redactIdentifier } from '@/commons/security/password';
import { normalizePhoneNumber } from '@repo/utils';
import { BE_ERRORS } from '@repo/errors';
import { logger } from '@repo/logger';
import { generateRefreshToken, getTokenLifetimes, parseDeviceInfo, getLocation, signAccessToken } from '../services/auth.service';
import { apiSuccess, apiError } from '@/commons/http/response';
import { isRedisAvailable, sessionMetaCache, cache } from '@/providers/redis';
import type { LoginContext, RefreshContext, LogoutContext } from '../types/handler.types';

const userRepo = new UserRepository(db);
const sessionRepo = new SessionRepository(db);

const tokenMeta = getTokenLifetimes();

/** TTL matches refresh token lifetime */
const SESSION_META_TTL_SECONDS = SHARED_CONSTANTS.AUTH.REFRESH_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60;

export const session = {
  login: async ({ body, request, jwt }: LoginContext) => {
    const { identifier, password } = body;
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!identifier) {
      return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    let user = null;
    if (identifier.includes('@')) {
      user = await userRepo.findByEmail(identifier);
    } else {
      const normalizedPhone = normalizePhoneNumber(identifier);
      if (normalizedPhone) {
        user = await userRepo.findByPhone(normalizedPhone);
      }
    }

    if (!user) {
      await hashPassword(password);
      return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    // --- Lockout check: DB field as persistent fallback, Redis for fast rejection ---
    if (user.isLocked) {
      if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        return apiError(BE_ERRORS.AUTH_ACCOUNT_LOCKED);
      }
      // Lockout expired — reset in DB
      await userRepo.resetFailedAttempts(user.id);
      user.failedLoginAttempts = 0;
      user.isLocked = false;
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      // --- Redis-based failed login attempt tracking ---
      const attemptKey = `login:attempts:${identifier}`;
      const attempts = await cache.incr(attemptKey, SHARED_CONSTANTS.AUTH.LOCKOUT_DURATION_MS / 1000);

      if (attempts >= authConfig.OTP.MAX_ATTEMPTS) {
        // Lock the account in DB (rare write — only on actual lockout)
        const lockoutUntil = new Date(Date.now() + SHARED_CONSTANTS.AUTH.LOCKOUT_DURATION_MS);
        await userRepo.updateLockoutStatus(user.id, attempts, true, lockoutUntil);
        logger.security('Account locked due to failed login attempts', {
          userId: user.id,
          identifier: redactIdentifier(identifier),
          attempts
        });
        return apiError(BE_ERRORS.AUTH_ACCOUNT_LOCKED);
      }

      return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    // --- Successful login: clear Redis attempts, unlock DB if needed ---
    if (isRedisAvailable()) {
      await cache.del(`login:attempts:${identifier}`);
    }
    if (user.failedLoginAttempts > 0 || user.isLocked) {
      await userRepo.resetFailedAttempts(user.id);
    }

    const accessToken = await signAccessToken(jwt, user);
    if (!accessToken) {
      return apiError(BE_ERRORS.AUTH_TOKEN_INVALID, 'Failed to generate access token');
    }

    const refreshToken = generateRefreshToken();
    const [accessTokenHash, refreshTokenHash, location] = await Promise.all([
      hashToken(accessToken),
      hashToken(refreshToken),
      getLocation(ipAddress)
    ]);

    const deviceInfo = parseDeviceInfo(userAgent);
    const sessionId = randomUUIDv7();

    await sessionRepo.create({
      id: sessionId,
      userId: user.id,
      accessTokenHash,
      refreshToken: refreshTokenHash,
      accessTokenExpiresAt: new Date(Date.now() + tokenMeta.accessMs),
      refreshTokenExpiresAt: new Date(Date.now() + tokenMeta.refreshMs),
      status: 'active',
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      location: null,
      ipAddress: null,
      userAgent: null,
      revokedAt: null,
      revokedReason: null,
      lastRefreshedAt: null,
      lastActiveAt: null,
      deletedAt: null
    });

    // --- Store volatile session metadata in Redis (avoids SQLite write bloat) ---
    if (isRedisAvailable()) {
      await sessionMetaCache.set(sessionId, {
        userAgent,
        ipAddress,
        location
      }, SESSION_META_TTL_SECONDS);
    }

    logger.app('User logged in', { userId: user.id, identifier: redactIdentifier(identifier) });

    return apiSuccess({
      user: toUserResponse(user),
      accessToken,
      refreshToken,
      expiresIn: tokenMeta.accessMs,
      refreshExpiresIn: tokenMeta.refreshMs
    }, 'Login successful');
  },

  refresh: async ({ body, jwt }: RefreshContext) => {
    const refreshToken = body.refreshToken;
    const refreshTokenHash = await hashToken(refreshToken);

    const activeSession = await sessionRepo.findActiveByRefreshToken(refreshTokenHash);
    if (!activeSession) {
      return apiError(BE_ERRORS.AUTH_INVALID_CREDENTIALS);
    }

    if (activeSession.refreshTokenExpiresAt < new Date()) {
      await sessionRepo.revokeById(activeSession.id, 'token_expired');
      return apiError(BE_ERRORS.AUTH_TOKEN_EXPIRED);
    }

    const user = await userRepo.findById(activeSession.userId);
    if (!user || !user.isActive) {
      await sessionRepo.revokeById(activeSession.id, 'user_inactive');
      return apiError(BE_ERRORS.USER_INACTIVE);
    }

    const accessToken = await signAccessToken(jwt, user);
    if (!accessToken) {
      return apiError(BE_ERRORS.AUTH_TOKEN_INVALID, 'Failed to generate access token');
    }

    const nextRefreshToken = generateRefreshToken();
    const [accessTokenHash, nextRefreshTokenHash] = await Promise.all([
      hashToken(accessToken),
      hashToken(nextRefreshToken)
    ]);

    await sessionRepo.update(activeSession.id, {
      accessTokenHash,
      refreshToken: nextRefreshTokenHash,
      accessTokenExpiresAt: new Date(Date.now() + tokenMeta.accessMs),
      refreshTokenExpiresAt: new Date(Date.now() + tokenMeta.refreshMs),
      lastRefreshedAt: new Date()
    });

    return apiSuccess({
      accessToken,
      refreshToken: nextRefreshToken,
      expiresIn: tokenMeta.accessMs,
      refreshExpiresIn: tokenMeta.refreshMs
    }, 'Token refreshed');
  },

  logout: async ({ body, user, sessionId }: LogoutContext) => {
    if (!user) {
      return apiSuccess({ loggedOut: true }, 'Logged out');
    }

    if (body.allDevices) {
      await sessionRepo.revokeAllForUser(user.id, sessionId || undefined);
      return apiSuccess({ loggedOut: true, allDevices: true }, 'Logged out from all devices');
    }

    if (sessionId) {
      await sessionRepo.revokeById(sessionId, 'user_logout');
    }

    return apiSuccess({ loggedOut: true }, 'Logged out');
  }
};
