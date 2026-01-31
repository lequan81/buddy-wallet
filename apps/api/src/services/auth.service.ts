/**
 * Auth Service (Class-based with Dependency Injection)
 *
 * Handles user registration, login, logout, and password management.
 * Uses constructor injection for testability.
 */
import { randomUUIDv7 } from 'bun';
import { users, sessions, debts, eq, and, or, isNull, ne, gte } from '@repo/db';
import { DEFAULT_USER_PERMISSIONS } from '@repo/permissions';
import { configs } from '@/configs';
import { hashToken, normalizePhoneNumber, parseUserAgent, getLocationFromIP, logger } from '@utils';
import type { DbClient } from '@/types';
import type { RegisterInput, LoginInput, AuthResult } from '@/types';

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

/**
 * AuthService class with dependency injection
 */
export class AuthService {
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

    return {
      success: true,
      user: { id: newUser.id, email: newUser.email, role: newUser.role }
    };
  }

  /**
   * Login a user
   */
  async login(
    input: LoginInput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwt: { sign: (payload: any) => Promise<string> }
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
      if (DUMMY_HASH) await Bun.password.verify(password, DUMMY_HASH);
      return { success: false, error: 'Invalid credentials' };
    }

    if (!user.isActive) {
      logger.auth(`Login blocked - account deactivated`, { userId: user.id });
      if (DUMMY_HASH) await Bun.password.verify(password, DUMMY_HASH);
      return { success: false, error: 'Invalid credentials' };
    }

    const validPassword = await Bun.password.verify(password, user.password);
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

    // Parse device info
    const deviceInfo = parseUserAgent(userAgent);
    const location = await getLocationFromIP(clientIP);

    // Generate tokens
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + configs.AUTH.ACCESS_TOKEN_LIFETIME);
    const refreshTokenExpiresAt = new Date(now + configs.AUTH.REFRESH_TOKEN_LIFETIME);

    const accessToken = await jwt.sign({
      id: user.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);
    const sessionId = randomUUIDv7('base64url');

    // Store session
    await this.db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      accessToken,
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
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
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
