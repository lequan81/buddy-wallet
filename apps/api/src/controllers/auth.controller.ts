import { randomUUIDv7 } from 'bun';
import { Elysia, t } from 'elysia';
import { sessionAuthPlugin } from '@plugins/session-auth';
import { authRateLimiter } from '@plugins/rate-limit';
import { sessionCache, jwtBlacklist, userCache, isRedisAvailable } from '@plugins/redis';
import { db, users, sessions, debts, eq, and, gte, or, isNull, ne } from '@repo/db';
import { configs } from '../configs';
import { DEFAULT_USER_PERMISSIONS } from '@repo/permissions';
import {
  hashToken,
  verifyTokenHash,
  normalizePhoneNumber,
  parseUserAgent,
  getClientIP,
  getLocationFromIP,
  logger
} from '@utils';

// Token lifetimes
// Token lifetimes
// const ACCESS_TOKEN_LIFETIME = 15 * 60 * 1000; // 15 minutes
// const REFRESH_TOKEN_LIFETIME = 90 * 24 * 60 * 60 * 1000; // 90 days
// const JWT_BLACKLIST_SECONDS = 15 * 60; // Match access token lifetime for blacklist

// Argon2id configuration (OWASP recommended)
// const ARGON2_OPTIONS = {
//   algorithm: 'argon2id' as const,
//   memoryCost: 65536, // 64MB RAM
//   timeCost: 3 // 3 iterations
// };

// Generate secure random refresh token
function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

// Constant for minimum password length
// Constant for minimum password length
// const MIN_PASSWORD_LENGTH = 8;

/**
 * Link existing debts to a newly registered user based on phone number
 */
async function linkDebtsToUser(userId: string, phoneNumber: string) {
  // Link debts where this user is the debtor
  await db
    .update(debts)
    .set({ debtorId: userId, updatedAt: new Date() })
    .where(and(eq(debts.debtorPhone, phoneNumber), isNull(debts.debtorId)));

  // Link debts where this user is the creditor
  await db
    .update(debts)
    .set({ creditorId: userId, updatedAt: new Date() })
    .where(and(eq(debts.creditorPhone, phoneNumber), isNull(debts.creditorId)));
}

export const authController = new Elysia({ prefix: '/auth' })
  .use(sessionAuthPlugin)
  .use(authRateLimiter) // Rate limit: 10 requests per minute
  .post(
    '/register',
    async ({ body, set }) => {
      const { name, email, password, phoneNumber } = body;

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        set.status = 400;
        return { success: false, message: 'Invalid phone number format' };
      }

      // Check phone uniqueness (required field)
      const existingPhone = db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, normalizedPhone))
        .get();
      if (existingPhone) {
        set.status = 400;
        return { success: false, message: 'Phone number already registered' };
      }

      // Check email uniqueness if provided
      if (email) {
        const existingEmail = db.select().from(users).where(eq(users.email, email)).get();
        if (existingEmail) {
          set.status = 400;
          return { success: false, message: 'Email already registered' };
        }
      }

      const hashedPassword = await Bun.password.hash(password, configs.AUTH.ARGON2_OPTIONS);
      const userId = randomUUIDv7('base64url');

      const [newUser] = await db
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

      // Auto-link existing debts to this user based on phone number
      await linkDebtsToUser(userId, normalizedPhone);

      set.status = 200;
      return { success: true, user: { id: newUser.id, email: newUser.email } };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        phoneNumber: t.String({ minLength: 10 }),
        email: t.Optional(t.String({ format: 'email' })),
        password: t.String({ minLength: 8 })
      })
    }
  )
  .post(
    '/login',
    async ({ body, jwt, cookie, set, request }) => {
      const { email, password } = body;
      logger.auth(`Login attempt`, { identifier: email });

      // Try finding user by email OR phone number
      const user = db
        .select()
        .from(users)
        .where(or(eq(users.email, email), eq(users.phoneNumber, email)))
        .get();

      if (!user) {
        logger.auth(`User not found`, { identifier: email });
        set.status = 401;
        return { success: false, error: 'Invalid credentials' };
      }

      const validPassword = await Bun.password.verify(password, user.password);
      if (!validPassword) {
        logger.auth(`Invalid password`, { userId: user.id });
        set.status = 401;
        return { success: false, error: 'Invalid credentials' };
      }

      logger.auth(`Login successful`, { userId: user.id });

      // Parse device info
      const userAgent = request.headers.get('user-agent');
      const deviceInfo = parseUserAgent(userAgent);
      const clientIP = getClientIP(request) || request.headers.get('x-forwarded-for');
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
      const refreshTokenHash = await hashToken(refreshToken); // Hash before storing
      const sessionId = randomUUIDv7('base64url');

      // Store session in database (with hashed refresh token and device info)
      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        accessToken,
        accessTokenExpiresAt,
        refreshToken: refreshTokenHash, // Store hash, not plain token
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

      // Set access token cookie (short-lived)
      cookie.session.set({
        value: accessToken,
        httpOnly: true,
        secure: configs.APP.IS_PROD,
        sameSite: 'strict',
        path: '/',
        maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000 // 15 minutes
      });

      // Set refresh token cookie (long-lived)
      cookie.refresh_token.set({
        value: refreshToken,
        httpOnly: true,
        secure: configs.APP.IS_PROD,
        sameSite: 'strict',
        path: '/', // Available to all paths (SvelteKit can read it)
        maxAge: configs.AUTH.REFRESH_TOKEN_LIFETIME / 1000 // 90 days
      });

      set.status = 200;
      return {
        success: true,
        user: { id: user.id, email: user.email, role: user.role },
        expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    }
  )
  .post('/refresh', async ({ jwt, cookie, set, request }) => {
    const refreshToken = cookie.refresh_token.value as string;

    if (!refreshToken) {
      set.status = 401;
      return { success: false, error: 'No refresh token provided' };
    }

    // Hash the provided token to compare with stored hash
    const refreshTokenHash = await hashToken(refreshToken);

    // Find ACTIVE session with this refresh token hash
    const session = db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, refreshTokenHash),
          eq(sessions.status, 'active'), // CHECK STATUS - revoked sessions rejected
          gte(sessions.refreshTokenExpiresAt, new Date())
        )
      )
      .get();

    if (!session) {
      // Clear invalid cookies
      cookie.session.remove();
      cookie.refresh_token.remove();
      set.status = 401;
      return { success: false, error: 'Session revoked or expired' };
    }

    // Get user
    const user = db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user) {
      set.status = 401;
      return { success: false, error: 'User not found' };
    }

    // Check if user account is active
    if (!user.isActive) {
      // Revoke session if user is deactivated
      await db
        .update(sessions)
        .set({ status: 'revoked', revokedAt: new Date(), revokedReason: 'admin_revoke' })
        .where(eq(sessions.id, session.id));
      cookie.session.remove();
      cookie.refresh_token.remove();
      set.status = 401;
      return { success: false, error: 'Account is deactivated' };
    }

    // Generate new access token
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + configs.AUTH.ACCESS_TOKEN_LIFETIME);
    const newAccessToken = await jwt.sign({
      id: user.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    });

    // Update session with new access token and activity
    await db
      .update(sessions)
      .set({
        accessToken: newAccessToken,
        accessTokenExpiresAt,
        lastRefreshedAt: new Date(),
        lastActiveAt: new Date(),
        userAgent: request.headers.get('user-agent') || session.userAgent,
        ipAddress: getClientIP(request) || session.ipAddress
      })
      .where(eq(sessions.id, session.id));

    // Set new access token cookie
    cookie.session.set({
      value: newAccessToken,
      httpOnly: true,
      secure: configs.APP.IS_PROD,
      sameSite: 'strict',
      path: '/',
      maxAge: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
    });

    set.status = 200;
    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      expiresIn: configs.AUTH.ACCESS_TOKEN_LIFETIME / 1000
    };
  })
  .get('/me', async ({ user }) => {
    return { user };
  })
  // Secure logout - requires authenticated user and validates session ownership
  .post('/logout', async ({ user, cookie, set }) => {
    const refreshToken = cookie.refresh_token.value as string;
    const accessToken = cookie.session.value as string;

    // Security: Require at least one valid token
    if (!refreshToken && !accessToken) {
      set.status = 401;
      return { success: false, error: 'No valid session' };
    }

    // If we have a refresh token, validate and invalidate the session
    if (refreshToken) {
      const refreshTokenHash = await hashToken(refreshToken);

      // Find the session
      const session = db
        .select()
        .from(sessions)
        .where(eq(sessions.refreshToken, refreshTokenHash))
        .get();

      // Security: If user is authenticated, verify session belongs to them
      if (session && user && session.userId !== user.id) {
        set.status = 403;
        return { success: false, error: 'Session does not belong to user' };
      }

      // Soft delete: Mark session as logged out
      if (session) {
        await db
          .update(sessions)
          .set({
            status: 'logged_out',
            revokedAt: new Date(),
            revokedReason: 'user_logout'
          })
          .where(eq(sessions.id, session.id));

        // Invalidate session cache and blacklist the access token
        if (isRedisAvailable()) {
          if (session.accessToken) {
            await sessionCache.del(session.accessToken);
            // Blacklist the access token to prevent reuse until it expires
            await jwtBlacklist.add(session.accessToken, configs.AUTH.JWT_BLACKLIST_SECONDS);
          }
        }
      }
    }

    // Clear both cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return { success: true };
  })
  // Logout from all devices
  .post('/logout-all', async ({ user, cookie, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    // Revoke ALL active sessions for this user
    const activeSessions = db
      .select({ id: sessions.id, accessToken: sessions.accessToken })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), eq(sessions.status, 'active')))
      .all();

    await db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'logout_all_devices'
      })
      .where(and(eq(sessions.userId, user.id), eq(sessions.status, 'active')));

    // Invalidate all session caches and blacklist all access tokens
    if (isRedisAvailable()) {
      await Promise.all(
        activeSessions.map(async (s) => {
          if (s.accessToken) {
            await sessionCache.del(s.accessToken);
            // Blacklist to prevent reuse
            await jwtBlacklist.add(s.accessToken, configs.AUTH.JWT_BLACKLIST_SECONDS);
          }
        })
      );
    }

    // Clear current session cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return { success: true, message: 'All sessions have been logged out' };
  })
  // Get list of active sessions for current user
  .get('/sessions', async ({ user, cookie, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    // Find current session ID by matching the refresh token
    let currentSessionId: string | null = null;
    const refreshToken = cookie.refresh_token.value as string;
    if (refreshToken) {
      const refreshTokenHash = await hashToken(refreshToken);
      const currentSession = db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.refreshToken, refreshTokenHash))
        .get();
      currentSessionId = currentSession?.id || null;
    }

    const activeSessions = db
      .select({
        id: sessions.id,
        deviceName: sessions.deviceName,
        deviceType: sessions.deviceType,
        location: sessions.location,
        ipAddress: sessions.ipAddress,
        lastActiveAt: sessions.lastActiveAt,
        createdAt: sessions.createdAt
      })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), eq(sessions.status, 'active')))
      .orderBy(sessions.lastActiveAt)
      .all();

    return { success: true, sessions: activeSessions, currentSessionId };
  })
  // Revoke a specific session
  .post(
    '/sessions/:sessionId/revoke',
    async ({ user, params, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      // Find the session and verify it belongs to this user
      const session = db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.id, params.sessionId),
            eq(sessions.userId, user.id),
            eq(sessions.status, 'active')
          )
        )
        .get();

      if (!session) {
        set.status = 404;
        return { success: false, error: 'Session not found or already revoked' };
      }

      // Revoke the session
      await db
        .update(sessions)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedReason: 'user_revoked' as const
        })
        .where(eq(sessions.id, params.sessionId));

      // Invalidate session cache
      if (isRedisAvailable() && session.accessToken) {
        await sessionCache.del(session.accessToken);
      }

      // If user is revoking their current session, clear cookies
      const currentRefreshToken = cookie.refresh_token.value as string;
      if (currentRefreshToken) {
        const currentHash = await hashToken(currentRefreshToken);
        if (session.refreshToken === currentHash) {
          cookie.session.remove();
          cookie.refresh_token.remove();
        }
      }

      return { success: true, message: 'Session revoked' };
    },
    {
      params: t.Object({
        sessionId: t.String()
      })
    }
  )
  // Change password with session invalidation
  .post(
    '/change-password',
    async ({ user, body, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      const { currentPassword, newPassword } = body;

      // Get the user with password
      const dbUser = db.select().from(users).where(eq(users.id, user.id)).get();
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const validPassword = await Bun.password.verify(currentPassword, dbUser.password);
      if (!validPassword) {
        set.status = 400;
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedNewPassword = await Bun.password.hash(newPassword, configs.AUTH.ARGON2_OPTIONS);

      // Find current session to keep it active
      let currentSessionId: string | null = null;
      const refreshToken = cookie.refresh_token.value as string;
      if (refreshToken) {
        const refreshTokenHash = await hashToken(refreshToken);
        const currentSession = db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.refreshToken, refreshTokenHash))
          .get();
        currentSessionId = currentSession?.id || null;
      }

      // Update password and increment session version
      await db
        .update(users)
        .set({
          password: hashedNewPassword,
          sessionVersion: (dbUser.sessionVersion || 1) + 1,
          lastPasswordChangeAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      // Revoke ALL sessions except current (password change invalidation)
      if (currentSessionId) {
        await db
          .update(sessions)
          .set({
            status: 'revoked',
            revokedAt: new Date(),
            revokedReason: 'password_change'
          })
          .where(
            and(
              eq(sessions.userId, user.id),
              eq(sessions.status, 'active'),
              ne(sessions.id, currentSessionId)
            )
          );
      }

      return {
        success: true,
        message: 'Password changed successfully. Other sessions have been logged out.'
      };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: configs.AUTH.MIN_PASSWORD_LENGTH })
      })
    }
  );
