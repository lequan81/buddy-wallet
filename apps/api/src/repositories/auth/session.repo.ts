import { eq, and, ne, sessions } from '@repo/db';
import type { RevokedReason, Session as DBSession, DbClient } from '@repo/db';
import { db } from '@/providers/database';
import * as v from 'valibot';

// ── Valibot Validation Schemas ────────────────────────────────
const UpdateSessionSchema = v.object({
  status: v.optional(v.picklist(['active', 'revoked'])),
  accessTokenExpiresAt: v.optional(v.union([v.date(), v.null_()])),
  refreshTokenExpiresAt: v.optional(v.union([v.date(), v.null_()])),
  lastActiveAt: v.optional(v.union([v.date(), v.null_()])),
  lastRefreshedAt: v.optional(v.union([v.date(), v.null_()])),
  revokedAt: v.optional(v.union([v.date(), v.null_()])),
  revokedReason: v.optional(v.union([v.string(), v.null_()]))
});

/**
 * Session Repository
 * Data access layer for session operations
 * No DI container - uses direct db instance
 */
export class SessionRepository {
  constructor(private readonly database: DbClient = db) {}

  async findById(id: string): Promise<DBSession | null> {
    const session = await this.database.select().from(sessions).where(eq(sessions.id, id)).get();
    return (session as unknown as DBSession) || null;
  }

  async findActiveByRefreshToken(hash: string): Promise<DBSession | null> {
    const session = await this.database
      .select()
      .from(sessions)
      .where(and(eq(sessions.refreshToken, hash), eq(sessions.status, 'active')))
      .get();
    return (session as unknown as DBSession) || null;
  }

  async findActiveByAccessTokenHash(userId: string, accessTokenHash: string): Promise<DBSession | null> {
    const session = await this.database
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.accessTokenHash, accessTokenHash),
          eq(sessions.status, 'active')
        )
      )
      .get();
    return (session as unknown as DBSession) || null;
  }

  async findActiveByUserId(userId: string): Promise<DBSession[]> {
    return (await this.database
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .all()) as DBSession[];
  }

  async findActiveByIdAndUser(id: string, userId: string): Promise<DBSession | null> {
    const session = await this.database
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .get();
    return (session as unknown as DBSession) || null;
  }

  async update(id: string, data: Partial<DBSession>): Promise<void> {
    const result = v.safeParse(UpdateSessionSchema, data);
    if (!result.success) {
      const firstIssue = result.issues[0];
      throw new Error(`Session update validation failed: ${firstIssue?.message ?? 'Invalid data'}`);
    }
    await this.database.update(sessions).set(data).where(eq(sessions.id, id));
  }

  async revokeById(id: string, reason: string): Promise<void> {
    await this.database
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason as RevokedReason
      })
      .where(eq(sessions.id, id));
  }

  async revokeActiveSessionsForUser(userId: string): Promise<void> {
    await this.database
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'password_change'
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<DBSession[]> {
    const conditions = [eq(sessions.userId, userId), eq(sessions.status, 'active')];
    if (exceptSessionId) {
      conditions.push(ne(sessions.id, exceptSessionId));
    }

    const revoked = await this.database
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'logout_all_devices'
      })
      .where(and(...conditions))
      .returning();

    return revoked as DBSession[];
  }

  async create(data: Omit<DBSession, 'createdAt'>): Promise<void> {
    const sessionData = {
      ...data,
      createdAt: new Date()
    };
    await this.database.insert(sessions).values(sessionData as typeof sessions.$inferInsert);
  }

  async revokeOthers(userId: string, currentSessionId: string, reason: string): Promise<void> {
    await this.database
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason as RevokedReason
      })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.status, 'active'),
          ne(sessions.id, currentSessionId)
        )
      );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.database.delete(sessions).where(eq(sessions.userId, userId));
  }
}

