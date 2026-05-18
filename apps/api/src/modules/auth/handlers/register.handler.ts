/**
 * Register handler.
 * @logicType http
 *
 * All write operations (user creation, debt linking, email verification, session creation)
 * are wrapped in a single database transaction for atomicity.
 */

import { randomUUIDv7 } from 'bun';
import { configs } from '@/config';
import { SHARED_CONSTANTS } from '@repo/config';
import { log } from '@repo/logger';
import { db } from '@/providers/database';
import { UserRepository } from '@/repositories/user/user.repo';
import { SessionRepository } from '@/repositories/auth/session.repo';
import { EmailVerificationRepository } from '@/repositories/auth/email-verification.repo';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { toUserResponse, hashPassword, hashToken } from '@/commons/security/password';
import { DEFAULT_USER_PERMISSIONS } from '@/commons/security/permissions';
import { normalizePhoneNumber } from '@repo/utils';
import { BE_ERRORS } from '@repo/errors';
import { apiCreated, apiError } from '@/commons/http/response';
import {
  validateUserPassword,
  generateOtp,
  calculateOtpExpiry,
  generateRefreshToken,
  getTokenLifetimes,
  parseDeviceInfo,
  getLocation,
  signAccessToken
} from '../services/auth.service';
import { sendVerificationEmail } from '../services/email.service';
import { isRedisAvailable, sessionMetaCache } from '@/providers/redis';
import type { RegisterContext } from '../types/handler.types';

const userRepo = new UserRepository(db);
const tokenMeta = getTokenLifetimes();

/** TTL matches refresh token lifetime */
const SESSION_META_TTL_SECONDS = SHARED_CONSTANTS.AUTH.REFRESH_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60;

export const register = {
  handler: async ({ body, request, jwt, cookie }: RegisterContext) => {
    log.debug('REGISTER', 'Processing registration', { ...body, password: '***' });
    const { email, phone, password, fullName } = body;

    const passwordValidation = validateUserPassword(password);
    if ('code' in passwordValidation) {
      return apiError(BE_ERRORS.PASSWORD_INVALID, passwordValidation.error ?? 'Invalid password');
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return apiError(BE_ERRORS.AUTH_INVALID_PHONE);
    }

    // Pre-transaction checks (read-only, no lock needed)
    const [existingPhone, existingEmail] = await Promise.all([
      userRepo.findByPhone(normalizedPhone),
      email ? userRepo.findByEmail(email) : null
    ]);

    if (existingPhone) {
      return apiError(BE_ERRORS.AUTH_PHONE_EXISTS);
    }

    if (existingEmail) {
      return apiError(BE_ERRORS.AUTH_EMAIL_EXISTS);
    }

    // Prepare CPU-bound work outside transaction
    const hashedPassword = await hashPassword(password);
    const refreshToken = generateRefreshToken();
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const deviceInfo = parseDeviceInfo(userAgent);

    // Resolve IP to location (fire-and-forget safe — returns null on failure)
    const location = await getLocation(ipAddress);

    // All write operations in a single transaction for atomicity
    const result = await db.transaction(async (tx) => {
      const txUserRepo = new UserRepository(tx);
      const txDebtRepo = new DebtRepository(tx);
      const txEmailVerificationRepo = new EmailVerificationRepository(tx);
      const txSessionRepo = new SessionRepository(tx);

      // 1. Create user
      log.debug('REGISTER', 'Creating user with permissions', { permissions: DEFAULT_USER_PERMISSIONS });
      const newUser = await txUserRepo.create({
        name: fullName,
        email: email || null,
        phoneNumber: normalizedPhone,
        password: hashedPassword,
        permissions: DEFAULT_USER_PERMISSIONS as string[]
      });

      // 2. Link pre-existing debts to new user
      await txDebtRepo.linkDebtsToUser(newUser.id, normalizedPhone);

      // 3. Sign access token (needs user.id from step 1)
      const accessToken = await signAccessToken(jwt, newUser);
      if (!accessToken) {
        throw new Error('Failed to sign access token');
      }

      // 4. Hash tokens
      const [accessTokenHash, refreshTokenHash] = await Promise.all([
        hashToken(accessToken),
        hashToken(refreshToken)
      ]);

      // 5. Create session
      const sessionId = randomUUIDv7();
      await txSessionRepo.create({
        id: sessionId,
        userId: newUser.id,
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

      // 6. Create email verification OTP (if email provided)
      if (email) {
        const otp = generateOtp();
        const otpHash = await hashToken(otp);
        const expiresAt = calculateOtpExpiry();
        await txEmailVerificationRepo.create({
          id: randomUUIDv7(),
          userId: newUser.id,
          email,
          otpHash,
          expiresAt
        });

        // Fire-and-forget: send verification email
        sendVerificationEmail(email, otp, fullName).catch(() => {});
      }

      return {
        user: newUser,
        accessToken,
        refreshToken,
        expiresIn: tokenMeta.accessMs,
        refreshExpiresIn: tokenMeta.refreshMs,
        sessionId
      };
    });

    // --- Store volatile session metadata in Redis (avoids SQLite write bloat) ---
    if (isRedisAvailable()) {
      await sessionMetaCache.set(result.sessionId, {
        userAgent,
        ipAddress,
        location
      }, SESSION_META_TTL_SECONDS);
    }

    // Set HttpOnly cookies for security
    const isProd = configs.APP.IS_PRODUCTION;
    
    // @ts-ignore - cookie is available in Elysia context
    const { session: sessionCookie, refresh_token: refreshCookie } = cookie;

    sessionCookie.set({
      value: result.accessToken,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: tokenMeta.accessMs / 1000
    });

    refreshCookie.set({
      value: result.refreshToken,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: tokenMeta.refreshMs / 1000
    });

    return apiCreated({
      user: toUserResponse(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      refreshExpiresIn: result.refreshExpiresIn
    }, 'Registration successful');
  }
};
