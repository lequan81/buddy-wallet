import { users, eq, and, ne, count, inArray } from '@repo/db';
import type { DbClient } from '@/types';
import type { IUserRepository } from '@/types/repositories';
import type { User } from '@repo/db';
import { configs } from '@/configs';

export class UserDrizzleAdapter implements IUserRepository {
  constructor(private db: DbClient) { }

  async findMany(limit: number, offset: number): Promise<{ data: User[]; total: number }> {
    const safeLimit = Math.min(Math.max(limit, 1), configs.PAGINATION.MAX_LIMIT);
    const safeOffset = Math.min(Math.max(offset, 0), configs.PAGINATION.MAX_OFFSET ?? 50000);

    const countPromise = this.db.select({ count: count() }).from(users).get();
    const dataPromise = this.db.select().from(users).limit(safeLimit).offset(safeOffset).all();

    const [countRes, dataRes] = await Promise.allSettled([countPromise, dataPromise]);

    if (countRes.status === 'rejected') {
      throw new Error(`Database count query failed: ${String((countRes as PromiseRejectedResult).reason)}`);
    }
    if (dataRes.status === 'rejected') {
      throw new Error(`Database data query failed: ${String((dataRes as PromiseRejectedResult).reason)}`);
    }

    return {
      data: (dataRes as PromiseFulfilledResult<User[]>).value,
      total: (countRes as PromiseFulfilledResult<{ count: number }>).value?.count ?? 0
    };
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(users)
      .where(inArray(users.id, ids))
      .all() as unknown as Promise<User[]>;
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

  async consumePasswordResetToken(id: string, currentHash: string, updates: Partial<User>): Promise<boolean> {
    const [updated] = await this.db.update(users)
      .set(updates)
      .where(
        and(
          eq(users.id, id),
          eq(users.temporaryPassword, currentHash),
          eq(users.temporaryPasswordUsed, false)
        )
      )
      .returning({ id: users.id });
    return !!updated;
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

