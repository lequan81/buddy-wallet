import { users, sessions, eq, and, ne, count, gte } from '@repo/db';
import type { DbClient } from '@/types';
import type { IUserRepository, ISessionRepository } from '@repo/types';
import type { User, Session } from '@repo/db';

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: DbClient) {}

  async countAll(): Promise<number> {
    const result = await this.db.select({ count: count() }).from(users).get();
    return result?.count ?? 0;
  }

  async findPaginated(limit: number, offset: number): Promise<User[]> {
    return this.db.select().from(users).limit(limit).offset(offset).all() as unknown as Promise<User[]>;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.db.select().from(users).where(eq(users.id, id)).get();
    return (user as User) || null;
  }

  async findByPhone(phone: string, excludeId?: string): Promise<User | null> {
    const where = excludeId 
      ? and(eq(users.phoneNumber, phone), ne(users.id, excludeId))
      : eq(users.phoneNumber, phone);
    const existing = await this.db.select().from(users).where(where).get();
    return (existing as User) || null;
  }

  async findByEmail(email: string, excludeId?: string): Promise<User | null> {
    const where = excludeId 
      ? and(eq(users.email, email), ne(users.id, excludeId))
      : eq(users.email, email);
    const existing = await this.db.select().from(users).where(where).get();
    return (existing as User) || null;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await this.db.update(users).set(data).where(eq(users.id, id));
    return this.findById(id);
  }

  async updateStatus(id: string, isActive: boolean): Promise<User | null> {
    return this.update(id, { isActive });
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        ...data,
        id: (data as { id?: string }).id || Bun.randomUUIDv7('base64url'),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return row as User;
  }

  // Auth methods
  async findByPhoneWithPassword(phone: string): Promise<User | null> {
    return (await this.db.select().from(users).where(eq(users.phoneNumber, phone)).get()) || null;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return (await this.db.select().from(users).where(eq(users.email, email)).get()) || null;
  }

  async findByEmailAndPhone(email: string, phone: string): Promise<User | null> {
    return (
      (await this.db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.phoneNumber, phone)))
        .get()) || null
    );
  }

  async updateLockoutStatus(
    id: string,
    attempts: number,
    isLocked: boolean,
    lockoutUntil: Date | null
  ): Promise<void> {
    await this.db
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        isLocked,
        lockoutUntil,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        isLocked: false,
        lockoutUntil: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));
  }
}

export class DrizzleSessionRepository implements ISessionRepository {
  constructor(private db: DbClient) {}

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

  async revokeAllForUser(userId: string): Promise<Session[]> {
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
