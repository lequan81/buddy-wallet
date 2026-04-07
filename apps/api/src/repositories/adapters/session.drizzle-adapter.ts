import { sessions, eq, and, ne, gte } from '@repo/db';
import type { DbClient } from '@/types';
import type { ISessionRepository } from '@/types/repositories';
import type { Session } from '@repo/db';

export class SessionDrizzleAdapter implements ISessionRepository {
  constructor(private db: DbClient) { }

  async findById(id: string): Promise<Session | null> {
    const session = await this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    return (session as Session) || null;
  }

  async revokeActiveSessionsForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'admin_revoke'
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));
  }

  async findActiveByRefreshToken(hash: string): Promise<Session | null> {
    const session = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, hash),
          eq(sessions.status, 'active'),
          gte(sessions.refreshTokenExpiresAt, new Date())
        )
      )
      .get();
    return (session as Session) || null;
  }

  async update(id: string, data: Partial<Session>): Promise<void> {
    await this.db.update(sessions).set(data).where(eq(sessions.id, id));
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .orderBy(sessions.lastActiveAt)
      .all() as Session[];
  }

  async findActiveByIdAndUser(id: string, userId: string): Promise<Session | null> {
    const session = await this.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.id, id), eq(sessions.userId, userId), eq(sessions.status, 'active'))
      )
      .get();
    return (session as Session) || null;
  }

  async revokeById(id: string, reason: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason as Session['revokedReason']
      })
      .where(eq(sessions.id, id));
  }

  async revokeAllForUser(userId: string, _exceptSessionId?: string): Promise<number | Session[]> {
    const activeSessions = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .all();

    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'logout_all_devices'
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));

    return activeSessions as unknown as Session[];
  }

  async create(data: Omit<Session, 'createdAt'>): Promise<void> {
    const sessionData = {
      ...data,
      createdAt: new Date()
    };
    await this.db.insert(sessions).values(sessionData as typeof sessions.$inferInsert);
  }

  async revokeOthers(userId: string, currentSessionId: string, reason: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason as Session['revokedReason']
      })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.status, 'active'),
          ne(sessions.id, currentSessionId)
        )
      );
  }
}
