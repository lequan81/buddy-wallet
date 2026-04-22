import { injectable, inject } from 'tsyringe';
import { eq, and, ne } from '@repo/db';
import { sessions, type Session as DBSession, type DbClient } from '@repo/db';
import type { SessionRepositoryInterface } from '../Contracts/SessionRepositoryInterface';

@injectable()
export class SessionRepository implements SessionRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async findById(id: string): Promise<DBSession | null> {
    const session = await this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    return (session as any as DBSession) || null;
  }

  async findActiveByRefreshToken(hash: string): Promise<DBSession | null> {
    const session = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.refreshToken, hash), eq(sessions.status, 'active')))
      .get();
    return (session as any as DBSession) || null;
  }

  async findActiveByUserId(userId: string): Promise<DBSession[]> {
    return (await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .all()) as DBSession[];
  }

  async findActiveByIdAndUser(id: string, userId: string): Promise<DBSession | null> {
    const session = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId), eq(sessions.status, 'active')))
      .get();
    return (session as any as DBSession) || null;
  }

  async update(id: string, data: Partial<DBSession>): Promise<void> {
    await this.db.update(sessions).set(data).where(eq(sessions.id, id));
  }

  async revokeById(id: string, reason: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason as any
      })
      .where(eq(sessions.id, id));
  }

  async revokeActiveSessionsForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'password_change'
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<DBSession[] | number> {
    const activeSessions = await this.findActiveByUserId(userId);

    await this.db
      .update(sessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: 'logout_all_devices'
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));

    return activeSessions;
  }

  async create(data: Omit<DBSession, 'createdAt'>): Promise<void> {
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
        revokedReason: reason as any
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

