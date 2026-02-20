/**
 * Auth Service (Class-based with Dependency Injection)
 *
 * Handles user registration, login, logout, and password management.
 * Uses constructor injection for testability.
 * Implements IAuthService interface for LSP compliance.
 */
import { randomUUIDv7 } from 'bun';
import { users, sessions, debts, eq, and, or, isNull, ne } from '@repo/db';
import { DEFAULT_USER_PERMISSIONS } from '@repo/permissions';
import { configs } from '../configs';
import {
  hashToken,
  normalizePhoneNumber,
  parseUserAgent,
  getLocationFromIP,
  validatePasswordComplexity,
  isCommonPassword,
  toSafeUser
} from '../utils';
import { logger } from '@repo/logger';
import type { DbClient } from '../types';
import type { RegisterInput, LoginInput, AuthResult } from '../types';
import type { IAuthService } from '../types';
import { EmailService, EmailVerificationService } from './index';

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

interface JwtPayload {
  id: string;
  phoneNumber: string;
  sessionVersion: number;
  exp: number;
}

/**
 * AuthService class with dependency injection
 * Implements IAuthService for LSP compliance
 */
export class AuthService implements IAuthService {
  constructor(private db: DbClient) {}

  /**
   * Link existing debts to a newly registered user based on phone number
   */
  private async linkDebtsToUser(userId: string, phoneNumber: string) {
    await this.db
      .update(debts)
      .set({ debtorId: userId, updatedAt: new Date() })
      .where(and(eq(debts.debtorPhone, phoneNumber), isNull(debts.debtorId)));

    await this.db
      .update(debts)
      .set({ creditorId: userId, updatedAt: new Date() })
      .where(and(eq(debts.creditorPhone, phoneNumber), isNull(debts.creditorId)));
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const { name, email, password, phoneNumber } = input;

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // SECURITY: Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. ')
      };
    }

    // SECURITY: Check against common passwords
    if (isCommonPassword(password)) {
      return {
        success: false,
        error: 'Password is too common. Please choose a stronger password.'
      };
    }

    // Check phone uniqueness
    const existingPhone = this.db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, normalizedPhone))
      .get();
    if (existingPhone) {
      return { success: false, error: 'Phone number already registered' };
    }

    // Check email uniqueness if provided
    if (email) {
      const existingEmail = this.db.select().from(users).where(eq(users.email, email)).get();
      if (existingEmail) {
        return { success: false, error: 'Email already registered' };
      }
    }

    const hashedPassword = await Bun.password.hash(password, configs.AUTH.ARGON2_OPTIONS);
    const userId = randomUUIDv7('base64url');

    const [newUser] = await this.db
      .insert(users)
      .values({
        id: userId,
        name,
        email: email || null,
        phoneNumber: normalizedPhone,
        password: hashedPassword,
        role: 'user',
        permissions: DEFAULT_USER_PERMISSIONS,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    await this.linkDebtsToUser(userId, normalizedPhone);

    // Send verification OTP email if user has email
    if (newUser.email) {
      const result = await EmailVerificationService.createOtp(newUser.id, newUser.email);
      if (result.success && result.otp) {
        await EmailService.sendOtp(newUser.email, result.otp, newUser.name);
      }
    }

    return {
      success: true,
      user: toSafeUser(newUser)
    };
  }

  /**
   * Login a user
   */
  async login(
    input: LoginInput,
    jwt: { sign: (payload: JwtPayload) => Promise<string> }
  ): Promise<AuthResult & { sessionId?: string }> {
    const { identifier, password, userAgent, clientIP } = input;
    logger.auth(`Login attempt`, { identifier });

    // Find user by email OR phone number
    const user = this.db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.phoneNumber, identifier)))
      .get();

    // Check lockout status
    if (user && user.isLocked && user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remaining = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      logger.auth(`Login blocked - account locked`, { userId: user.id });
      return { success: false, error: `Account locked. Try again in ${remaining} minutes.` };
    }

    if (!user) {
      logger.auth(`User not found`, { identifier });
      if (DUMMY_HASH) await Bun.password.verify(password || '', DUMMY_HASH);
      return { success: false, error: 'Invalid credentials' };
    }

    if (!user.isActive) {
      logger.auth(`Login blocked - account deactivated`, { userId: user.id });
      if (DUMMY_HASH) await Bun.password.verify(password || '', DUMMY_HASH);
      return { success: false, error: 'Invalid credentials' };
    }

    let validPassword = await Bun.password.verify(password || '', user.password);
    let usedTempPassword = false;

    // If regular password fails, try temporary password
    if (!validPassword && user.temporaryPassword && user.temporaryPasswordExpires) {
      const tempExpiry = new Date(user.temporaryPasswordExpires);
      if (tempExpiry > new Date() && !user.temporaryPasswordUsed) {
        const validTempPassword = await Bun.password.verify(password || '', user.temporaryPassword);
        if (validTempPassword) {
          validPassword = true;
          usedTempPassword = true;
          logger.auth(`Login with temporary password`, { userId: user.id });
        }
      }
    }

    if (!validPassword) {
      logger.auth(`Invalid password`, { userId: user.id });

      const attempts = (user.failedLoginAttempts || 0) + 1;
      const shouldLock = attempts >= 5;

      await this.db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          lastFailedLoginAt: new Date(),
          isLocked: shouldLock,
          lockoutUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null
        })
        .where(eq(users.id, user.id));

      if (shouldLock) {
        logger.security(`Account locked due to too many failed attempts`, { userId: user.id });
      }

      return { success: false, error: 'Invalid credentials' };
    }

    // If temp password was used, mark it and require password change
    if (usedTempPassword) {
      await this.db
        .update(users)
        .set({
          temporaryPasswordUsed: true,
          mustChangePassword: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
    }

    logger.auth(`Login successful`, { userId: user.id });

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0 || user.isLocked) {
      await this.db
        .update(users)
        .set({
          failedLoginAttempts: 0,
          isLocked: false,
          lockoutUntil: null
        })
        .where(eq(users.id, user.id));
    }

    // Parse device info (use client hints if provided for more accuracy)
    const deviceInfo = parseUserAgent(userAgent || null, input.clientHints);
    const location = await getLocationFromIP(
      clientIP || null,
      input.clientLocation,
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
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);
    const accessTokenHash = await hashToken(accessToken); // SECURITY: Hash access token
    const sessionId = randomUUIDv7('base64url');

    // Store session
    await this.db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      accessToken: null, // DEPRECATED: No longer store plaintext token
      accessTokenHash, // Store hashed token for secure lookup
      accessTokenExpiresAt,
      refreshToken: refreshTokenHash,
      refreshTokenExpiresAt,
      status: 'active',
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      location: location,
      userAgent: userAgent || null,
      ipAddress: clientIP || null,
      lastActiveAt: new Date(),
      createdAt: new Date()
    });

    return {
      success: true,
      user: toSafeUser(user),
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000,
      mustChangePassword: usedTempPassword || user.mustChangePassword
    };
  }

  /**
   * Logout - revoke a session
   */
  async logout(
    refreshToken: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!refreshToken) {
      return { success: false, error: 'No refresh token provided' };
    }

    const refreshTokenHash = await hashToken(refreshToken);

    const session = this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshToken, refreshTokenHash))
      .get();

    if (session && userId && session.userId !== userId) {
      return { success: false, error: 'Session does not belong to user' };
    }

    if (session) {
      await this.db
        .update(sessions)
        .set({
          status: 'logged_out',
          revokedAt: new Date(),
          revokedReason: 'user_logout'
        })
        .where(eq(sessions.id, session.id));
    }

    return { success: true };
  }

  /**
   * Change password and revoke other sessions
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const dbUser = this.db.select().from(users).where(eq(users.id, userId)).get();
    if (!dbUser) {
      return { success: false, error: 'User not found' };
    }

    const validPassword = await Bun.password.verify(currentPassword, dbUser.password);
    if (!validPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // SECURITY: Validate new password complexity
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. ')
      };
    }

    // SECURITY: Check against common passwords
    if (isCommonPassword(newPassword)) {
      return {
        success: false,
        error: 'Password is too common. Please choose a stronger password.'
      };
    }

    const hashedNewPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

    await this.db
      .update(users)
      .set({
        password: hashedNewPassword,
        sessionVersion: (dbUser.sessionVersion || 1) + 1,
        lastPasswordChangeAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    if (currentSessionId) {
      await this.db
        .update(sessions)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedReason: 'password_change'
        })
        .where(
          and(
            eq(sessions.userId, userId),
            eq(sessions.status, 'active'),
            ne(sessions.id, currentSessionId)
          )
        );
    }

    return { success: true };
  }
}
