import { injectable, inject } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import { configs } from '@/configs';
import type { UserRepositoryInterface } from '@/app/Repositories/Contracts/UserRepositoryInterface';
import type { SessionRepositoryInterface } from '@/app/Repositories/Contracts/SessionRepositoryInterface';
import {
  hashToken,
  generateSecureToken,
  parseUserAgent,
  getLocationFromIP,
  toSafeUser,
  redactIdentifier
} from '@lib/security/password';
import { logger } from '@repo/logger';
import type { JwtService } from '@/types';
import type { LoginInput, AuthResult } from '@/types';

// Dummy hash for timing attack mitigation (pre-calculated at startup)
let DUMMY_HASH = '';
Bun.password.hash('dummy', configs.AUTH.ARGON2_OPTIONS).then((h) => (DUMMY_HASH = h));

/**
 * AuthSecurityService - Login security and session creation
 */
@injectable()
export class AuthSecurityService {
  constructor(
    @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface,
    @inject('SessionRepositoryInterface') private readonly sessionRepo: SessionRepositoryInterface
  ) {}

  /**
   * Login a user with security checks
   */
  async login(
    input: LoginInput,
    jwt: JwtService
  ): Promise<AuthResult> {
    try {
      const { identifier, password, userAgent, clientIP } = input;
      const identifierType = identifier.includes('@') ? 'email' : 'phone';
      logger.auth(`Login attempt`, {
        identifierType,
        identifierHash: redactIdentifier(identifier)
      });

      // Find user by email OR phone number
      const user = identifier.includes('@') 
        ? await this.userRepo.findByEmailWithPassword(identifier)
        : await this.userRepo.findByPhoneWithPassword(identifier);

      // Check lockout status
      if (user && user.isLocked && user.lockoutUntil && user.lockoutUntil > new Date()) {
        const remaining = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
        logger.auth(`Login blocked - account locked`, { userId: user.id });
        return { code: 'ACCOUNT_LOCKED', error: `Account locked. Try again in ${remaining} minutes.` };
      }

      if (!user) {
        logger.auth(`User not found`, {
          identifierType,
          identifierHash: redactIdentifier(identifier)
        });
        if (DUMMY_HASH) await Bun.password.verify(password || '', DUMMY_HASH);
        return { code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' };
      }

      if (!user.isActive) {
        logger.auth(`Login blocked - account deactivated`, { userId: user.id });
        if (DUMMY_HASH) await Bun.password.verify(password || '', DUMMY_HASH);
        return { code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' };
      }

      const validPassword = await Bun.password.verify(password || '', user.password);

      if (!validPassword) {
        logger.auth(`Invalid password`, { userId: user.id });

        const attempts = (user.failedLoginAttempts || 0) + 1;
        const shouldLock = attempts >= 5;

        await this.userRepo.updateLockoutStatus(
          user.id,
          attempts,
          shouldLock,
          shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null
        );

        if (shouldLock) {
          logger.security(`Account locked due to too many failed attempts`, { userId: user.id });
        }

        return { code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' };
      }

      logger.auth(`Login successful`, { userId: user.id });

      // Reset failed attempts on success
      if ((user.failedLoginAttempts || 0) > 0 || user.isLocked) {
        await this.userRepo.resetFailedAttempts(user.id);
      }

      // Parse device info
      const deviceInfo = parseUserAgent(userAgent || null, input.clientHints);
      const clientLocationStr = input.clientLocation
        ? [input.clientLocation.city, input.clientLocation.country]
            .filter(Boolean)
            .join(', ') || null
        : null;
      const location = await getLocationFromIP(
        clientIP || null,
        clientLocationStr,
        input.coordinates
      );

      // Generate tokens
      const now = Date.now();
      const accessTokenExpiresAt = new Date(now + configs.AUTH.ACCESS_TOKEN_LIFETIME);
      const refreshTokenExpiresAt = new Date(now + configs.AUTH.REFRESH_TOKEN_LIFETIME);

      const accessToken = await jwt.sign({
        id: user.id,
        phoneNumber: user.phoneNumber,
        sessionVersion: user.sessionVersion || 1,
        exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
      });
      const refreshToken = generateSecureToken(32);
      const refreshTokenHash = await hashToken(refreshToken);
      const accessTokenHash = await hashToken(accessToken);
      const sessionId = randomUUIDv7();

      // Store session
      await this.sessionRepo.create({
        id: sessionId,
        userId: user.id,
        accessTokenHash,
        accessTokenExpiresAt,
        refreshToken: refreshTokenHash,
        refreshTokenExpiresAt,
        status: 'active',
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        location: location as Parameters<typeof this.sessionRepo.create>[0]['location'],
        userAgent: userAgent || null,
        ipAddress: clientIP || null,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as Parameters<typeof this.sessionRepo.create>[0]);

      return {
        data: {
          user: toSafeUser(user),
          accessToken,
          refreshToken,
          sessionId,
          expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000,
          mustChangePassword: user.mustChangePassword
        }
      };
    } catch (error: unknown) {
      logger.error('Database error during login', { error: String(error) });
      return { code: 'DATABASE_ERROR', error: 'Service temporarily unavailable' };
    }
  }

  /**
   * Refresh user session with new tokens
   */
  async refreshSession(
    refreshToken: string,
    jwt: JwtService,
    options?: { userAgent?: string; clientIP?: string }
  ): Promise<AuthResult> {
    try {
      if (!refreshToken) {
        return { code: 'INVALID_TOKEN', error: 'No refresh token provided' };
      }

      const refreshTokenHash = await hashToken(refreshToken);
      const session = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);

      if (!session) {
        logger.auth('Refresh token not found', { });
        return { code: 'INVALID_TOKEN', error: 'Invalid refresh token' };
      }

      // Check if refresh token is expired
      if (session.refreshTokenExpiresAt < new Date()) {
        logger.auth('Refresh token expired', { userId: session.userId });
        return { code: 'TOKEN_EXPIRED', error: 'Refresh token has expired' };
      }

      // Fetch user
      const user = await this.userRepo.findById(session.userId);
      if (!user) {
        logger.auth('User not found during refresh', { userId: session.userId });
        return { code: 'NOT_FOUND', error: 'User not found' };
      }

      if (!user.isActive) {
        logger.auth('Refresh blocked - account deactivated', { userId: user.id });
        return { code: 'ACCOUNT_INACTIVE', error: 'Account is not active' };
      }

      // Generate new tokens
      const now = Date.now();
      const accessTokenExpiresAt = new Date(now + configs.AUTH.ACCESS_TOKEN_LIFETIME);
      const refreshTokenExpiresAt = new Date(now + configs.AUTH.REFRESH_TOKEN_LIFETIME);

      const accessToken = await jwt.sign({
        id: user.id,
        phoneNumber: user.phoneNumber,
        sessionVersion: user.sessionVersion || 1,
        exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
      });

      const newRefreshToken = generateSecureToken(32);
      const newRefreshTokenHash = await hashToken(newRefreshToken);
      const accessTokenHash = await hashToken(accessToken);

      // Update session with new tokens
      await this.sessionRepo.update(session.id, {
        accessTokenHash,
        accessTokenExpiresAt,
        refreshToken: newRefreshTokenHash,
        refreshTokenExpiresAt,
        lastActiveAt: new Date()
      });

      logger.auth('Session refreshed', { userId: user.id });

      return {
        data: {
          user: toSafeUser(user),
          accessToken,
          refreshToken: newRefreshToken,
          sessionId: session.id,
          expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
        }
      };
    } catch (error: unknown) {
      logger.error('Error refreshing session', { error: String(error) });
      return { code: 'DATABASE_ERROR', error: 'Service temporarily unavailable' };
    }
  }
}
