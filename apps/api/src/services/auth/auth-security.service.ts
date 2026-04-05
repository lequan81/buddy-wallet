/**
 * Auth Security Service
 * 
 * Handles login security operations:
 * - User login with password verification
 * - Account lockout handling
 * - Failed login attempt tracking
 * - Session creation with JWT
 * 
 * Dependencies: db
 */
import { randomUUIDv7 } from 'bun';
import { configs } from '../../configs';
import type { IUserRepository, ISessionRepository } from '@/types/repositories';
import {
  hashToken,
  generateSecureToken,
  parseUserAgent,
  getLocationFromIP,
  toSafeUser,
  redactIdentifier
} from '@utils';
import { logger } from '@repo/logger';
import type { JwtService } from '@/types';
import type { LoginInput, AuthResult } from '@/types';

// Dummy hash for timing attack mitigation (pre-calculated at startup)
let DUMMY_HASH = '';
Bun.password.hash('dummy', configs.AUTH.ARGON2_OPTIONS).then((h) => (DUMMY_HASH = h));

/**
 * Generate secure random refresh token
 */
function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

// Remove local redactIdentifier

/**
 * AuthSecurityService - Login security and session creation
 */
export class AuthSecurityService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly sessionRepo: ISessionRepository
  ) {}

  /**
   * Login a user with security checks
   */
  async login(
    input: LoginInput,
    jwt: JwtService
  ): Promise<AuthResult & { sessionId?: string }> {
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
        return { success: false, error: `Account locked. Try again in ${remaining} minutes.` };
      }

      if (!user) {
        logger.auth(`User not found`, {
          identifierType,
          identifierHash: redactIdentifier(identifier)
        });
        if (DUMMY_HASH) await Bun.password.verify(password || '', DUMMY_HASH);
        return { success: false, error: 'Invalid credentials' };
      }

      if (!user.isActive) {
        logger.auth(`Login blocked - account deactivated`, { userId: user.id });
        if (DUMMY_HASH) await Bun.password.verify(password || '', DUMMY_HASH);
        return { success: false, error: 'Invalid credentials' };
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

        return { success: false, error: 'Invalid credentials' };
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
      const sessionId = randomUUIDv7('base64url');

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
        lastActiveAt: new Date()
      } as Parameters<typeof this.sessionRepo.create>[0]);

      return {
        success: true,
        user: toSafeUser(user),
        accessToken,
        refreshToken,
        sessionId,
        expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000,
        mustChangePassword: user.mustChangePassword
      };
    } catch (error: unknown) {
      logger.error('Database error during login', { error: String(error) });
      return { success: false, error: 'DATABASE_ERROR' };
    }
  }
}
