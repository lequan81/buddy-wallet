import { injectable, inject } from 'tsyringe';
import { type User } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import type { UserRepositoryInterface } from '@/app/Repositories/Contracts/UserRepositoryInterface';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import type { SessionRepositoryInterface } from '@/app/Repositories/Contracts/SessionRepositoryInterface';
import { configs } from '@/configs';
import { normalizePhoneNumber } from '@repo/utils';
import {
  toSafeUser,
  validatePasswordComplexity,
  isCommonPassword,
  hashToken,
  generateSecureToken,
  parseUserAgent,
  getLocationFromIP,
  redactIdentifier
} from '@lib/security/password';
import { logger } from '@repo/logger';
import { EmailService } from './EmailService';
import { EmailVerificationService } from './EmailVerificationService';
import type { RegisterInput, LoginInput, AuthResult, JwtService } from '@/types';
import { DatabaseError as _DatabaseError } from '@lib/result';
import type { Result } from '@repo/types';

const DEFAULT_USER_PERMISSIONS: string[] = [];

// Dummy hash for timing attack mitigation (pre-calculated at startup)
let DUMMY_HASH = '';
Bun.password.hash('dummy', configs.AUTH.ARGON2_OPTIONS).then((h) => (DUMMY_HASH = h));

/**
 * AuthService - Consolidated authentication service
 *
 * Handles:
 * - User registration
 * - User login with security checks
 * - Session management (logout, changePassword)
 *
 * Delegates to:
 * - UserRepository for user data
 * - DebtRepository for debt linking
 * - SessionRepository for session creation
 * - EmailService for OTP delivery
 * - EmailVerificationService for OTP management
 */
@injectable()
export class AuthService {
  constructor(
    @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface,
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject('SessionRepositoryInterface') private readonly sessionRepo: SessionRepositoryInterface,
    private readonly emailService: EmailService,
    private readonly emailVerificationService: EmailVerificationService
  ) {}

  // ── Register ────────────────────────────────────────────────

  /**
   * Link existing debts to a newly registered user based on phone number
   */
  private async linkDebtsToUser(userId: string, phoneNumber: string) {
    await this.debtRepo.linkDebtsToUser(userId, phoneNumber);
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    try {
      const { name, email, password, phoneNumber } = input;

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        return { code: 'INVALID_PHONE', error: 'Invalid phone number format' };
      }

      // SECURITY: Validate password complexity
      const passwordValidation = validatePasswordComplexity(password);
      if (!passwordValidation.isValid) {
        return {
          code: 'INVALID_PASSWORD',
          error: passwordValidation.errors.join('. ')
        };
      }

      // SECURITY: Check against common passwords
      if (isCommonPassword(password)) {
        return {
          code: 'WEAK_PASSWORD',
          error: 'Password is too common. Please choose a stronger password.'
        };
      }

      // Check phone uniqueness
      const existingPhone = await this.userRepo.findByPhone(normalizedPhone);
      if (existingPhone) {
        return { code: 'PHONE_EXISTS', error: 'Phone number already registered' };
      }

      // Check email uniqueness if provided
      if (email) {
        const existingEmail = await this.userRepo.findByEmail(email);
        if (existingEmail) {
          return { code: 'EMAIL_EXISTS', error: 'Email already registered' };
        }
      }

      const hashedPassword = await Bun.password.hash(password, configs.AUTH.ARGON2_OPTIONS);
      let newUser: User;
      try {
        newUser = await this.userRepo.create({
          name,
          email: email || null,
          phoneNumber: normalizedPhone,
          password: hashedPassword,
          permissions: DEFAULT_USER_PERMISSIONS,
          temporaryPasswordUsed: false
        } as Parameters<typeof this.userRepo.create>[0]);
      } catch (error) {
        if (error instanceof _DatabaseError) {
          return {
            code: 'DATABASE_ERROR',
            error: 'Database temporarily unavailable. Please try again later.'
          };
        }
        throw error;
      }

      await this.linkDebtsToUser(newUser.id, normalizedPhone);

      // Send verification OTP email if user has email
      if (newUser?.email) {
        const result = await this.emailVerificationService.createOtp(newUser.id, newUser.email);
        if ('data' in result && result.data.otp) {
          await this.emailService.sendOtp(newUser.email, result.data.otp, newUser.name);
        }
      }

      return {
        data: {
          user: toSafeUser(newUser)
        }
      };
    } catch (error: unknown) {
      logger.error('Database error during register', { error: String(error) });
      return { code: 'UNKNOWN_ERROR', error: 'An unexpected error occurred' };
    }
  }

  // ── Login ───────────────────────────────────────────────────

  /**
   * Login a user with security checks and create session
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

  // ── Session Management ──────────────────────────────────────

  /**
   * Logout - revoke a session
   */
  async logout(
    refreshToken: string,
    userId?: string
  ): Promise<Result<void>> {
    if (!refreshToken) {
      return { code: 'MISSING_TOKEN', error: 'No refresh token provided' };
    }

    const refreshTokenHash = await hashToken(refreshToken);
    const session = await this.sessionRepo.findActiveByRefreshToken(refreshTokenHash);

    if (session && userId && session.userId !== userId) {
      return { code: 'FORBIDDEN', error: 'Session does not belong to user' };
    }

    if (session) {
      await this.sessionRepo.revokeById(session.id, 'user_logout');
    }

    return { data: undefined };
  }

  /**
   * Change password and revoke other sessions
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<Result<void>> {
    const dbUser = await this.userRepo.findById(userId);
    if (!dbUser) {
      return { code: 'NOT_FOUND', error: 'User not found' };
    }

    const validPassword = await Bun.password.verify(currentPassword, dbUser.password);
    if (!validPassword) {
      return { code: 'INVALID_CREDENTIALS', error: 'Current password is incorrect' };
    }

    // SECURITY: Validate new password complexity
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.isValid) {
      return {
        code: 'INVALID_PASSWORD',
        error: passwordValidation.errors.join('. ')
      };
    }

    // SECURITY: Check against common passwords
    if (isCommonPassword(newPassword)) {
      return {
        code: 'WEAK_PASSWORD',
        error: 'Password is too common. Please choose a stronger password.'
      };
    }

    const hashedNewPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

    await this.userRepo.update(userId, {
      password: hashedNewPassword,
      sessionVersion: (dbUser.sessionVersion || 1) + 1,
      lastPasswordChangeAt: new Date()
    });

    if (currentSessionId) {
      await this.sessionRepo.revokeOthers(userId, currentSessionId, 'password_change');
    }

    return { data: undefined };
  }
}
