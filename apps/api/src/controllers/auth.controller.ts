import { randomUUIDv7 } from 'bun';
import { Elysia, t } from 'elysia';
import { jwtSecurityProvider } from '@/plugins/jwt';
import { db, users, sessions, debts, eq, and, gte, or } from '@repo/db';
import { DEFAULT_USER_PERMISSIONS } from '@repo/permissions';

// Token lifetimes
const ACCESS_TOKEN_LIFETIME = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_LIFETIME = 90 * 24 * 60 * 60 * 1000; // 90 days

// Generate secure random refresh token
function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Link existing debts to a newly registered user based on phone number
 */
async function linkDebtsToUser(userId: string, phoneNumber: string) {
  // Link debts where this user is the debtor
  await db
    .update(debts)
    .set({ debtorId: userId, updatedAt: new Date() })
    .where(and(eq(debts.debtorPhone, phoneNumber), eq(debts.debtorId, null)));

  // Link debts where this user is the creditor
  await db
    .update(debts)
    .set({ creditorId: userId, updatedAt: new Date() })
    .where(and(eq(debts.creditorPhone, phoneNumber), eq(debts.creditorId, null)));
}

export const authController = new Elysia({ prefix: '/auth' })
  .use(jwtSecurityProvider)
  .post(
    '/register',
    async ({ body, set }) => {
      const { name, email, password, phoneNumber } = body;

      // Check phone uniqueness (required field)
      const existingPhone = db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).get();
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

      const hashedPassword = await Bun.password.hash(password);
      const userId = randomUUIDv7('base64url');

      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          name,
          email: email || null,
          phoneNumber,
          password: hashedPassword,
          role: 'user',
          permissions: DEFAULT_USER_PERMISSIONS,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Auto-link existing debts to this user based on phone number
      if (phoneNumber) {
        await linkDebtsToUser(userId, phoneNumber);
      }

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
      console.log(`[AUTH] Login attempt for: ${email}`);

      // Try finding user by email OR phone number
      const user = await db
        .select()
        .from(users)
        .where(or(eq(users.email, email), eq(users.phoneNumber, email)))
        .get();

      if (!user) {
        console.log(`[AUTH] User not found: ${email}`);
        set.status = 401;
        return { success: false, error: 'Invalid credentials' };
      }

      const validPassword = await Bun.password.verify(password, user.password);
      if (!validPassword) {
        console.log(`[AUTH] Invalid password for user: ${user.id}`);
        set.status = 401;
        return { success: false, error: 'Invalid credentials' };
      }

      console.log(`[AUTH] Login successful for user: ${user.id}`);

      // Generate tokens
      const now = Date.now();
      const accessTokenExpiresAt = new Date(now + ACCESS_TOKEN_LIFETIME);
      const refreshTokenExpiresAt = new Date(now + REFRESH_TOKEN_LIFETIME);

      const accessToken = await jwt.sign({
        id: user.id,
        exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
      });
      const refreshToken = generateRefreshToken();
      const sessionId = randomUUIDv7('base64url');

      // Store session in database
      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        refreshTokenExpiresAt,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        createdAt: new Date()
      });

      // Set access token cookie (short-lived)
      cookie.session.set({
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: ACCESS_TOKEN_LIFETIME / 1000 // 15 minutes
      });

      // Set refresh token cookie (long-lived)
      cookie.refresh_token.set({
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/v1/auth', // Only sent to auth endpoints
        maxAge: REFRESH_TOKEN_LIFETIME / 1000 // 90 days
      });

      set.status = 200;
      return {
        success: true,
        user: { id: user.id, email: user.email, role: user.role },
        expiresIn: ACCESS_TOKEN_LIFETIME / 1000
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
    const refreshToken = cookie.refresh_token.value;

    if (!refreshToken) {
      set.status = 401;
      return { success: false, error: 'No refresh token provided' };
    }

    // Find valid session with this refresh token
    const session = db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, refreshToken),
          gte(sessions.refreshTokenExpiresAt, new Date())
        )
      )
      .get();

    if (!session) {
      // Clear invalid cookies
      cookie.session.remove();
      cookie.refresh_token.remove();
      set.status = 401;
      return { success: false, error: 'Invalid or expired refresh token' };
    }

    // Get user
    const user = db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user) {
      set.status = 401;
      return { success: false, error: 'User not found' };
    }

    // Generate new access token
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + ACCESS_TOKEN_LIFETIME);
    const newAccessToken = await jwt.sign({
      id: user.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    });

    // Update session with new access token
    await db
      .update(sessions)
      .set({
        accessToken: newAccessToken,
        accessTokenExpiresAt,
        lastRefreshedAt: new Date(),
        userAgent: request.headers.get('user-agent') || session.userAgent,
        ipAddress: request.headers.get('x-forwarded-for') || session.ipAddress
      })
      .where(eq(sessions.id, session.id));

    // Set new access token cookie
    cookie.session.set({
      value: newAccessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_TOKEN_LIFETIME / 1000
    });

    set.status = 200;
    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      expiresIn: ACCESS_TOKEN_LIFETIME / 1000
    };
  })
  .get('/me', ({ user }) => {
    return { user };
  })
  .post('/logout', async ({ cookie, set }) => {
    const refreshToken = cookie.refresh_token.value;

    // Delete session from database
    if (refreshToken) {
      await db.delete(sessions).where(eq(sessions.refreshToken, refreshToken));
    }

    // Clear both cookies
    cookie.session.remove();
    cookie.refresh_token.remove();

    set.status = 200;
    return { success: true };
  });
