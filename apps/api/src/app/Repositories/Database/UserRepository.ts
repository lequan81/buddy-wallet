import { injectable, inject } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import { eq, and, inArray, count, ne } from '@repo/db';
import { users, type User as DBUser, type DbClient } from '@repo/db';
import type { UserWithNotifications } from '@repo/types';
import type { UserRepositoryInterface } from '../Contracts/UserRepositoryInterface';
import { configs } from '@/config';

@injectable()
export class UserRepository implements UserRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async findMany(limit: number, offset: number): Promise<{ data: DBUser[]; total: number }> {
    const safeLimit = Math.min(Math.max(limit, 1), configs.PAGINATION.MAX_LIMIT);
    const safeOffset = Math.min(Math.max(offset, 0), configs.PAGINATION.MAX_OFFSET);

    const countPromise = this.db.select({ count: count() }).from(users).get();
    const dataPromise = this.db.select().from(users).limit(safeLimit).offset(safeOffset).all();

    const [countRes, dataRes] = await Promise.allSettled([countPromise, dataPromise]);

    if (countRes.status === 'rejected') {
      throw new Error(`Database count query failed: ${String(countRes.reason)}`);
    }
    if (dataRes.status === 'rejected') {
      throw new Error(`Database data query failed: ${String(dataRes.reason)}`);
    }

    return {
      data: dataRes.value as DBUser[],
      total: countRes.value?.count ?? 0
    };
  }

  async findByIds(ids: string[]): Promise<DBUser[]> {
    if (ids.length === 0) return [];

    return (await this.db
      .select()
      .from(users)
      .where(inArray(users.id, ids))
      .all()) as DBUser[];
  }

  async findById(id: string): Promise<DBUser | null> {
    const user = await this.db.select().from(users).where(eq(users.id, id)).get();
    return (user as DBUser) || null;
  }

  async findByPhone(phone: string, excludeId?: string): Promise<DBUser | null> {
    const conditions = [eq(users.phoneNumber, phone)];
    if (excludeId) conditions.push(ne(users.id, excludeId));

    const user = await this.db
      .select()
      .from(users)
      .where(and(...conditions))
      .get();
    return (user as DBUser) || null;
  }

  async findByEmail(email: string, excludeId?: string): Promise<DBUser | null> {
    const conditions = [eq(users.email, email)];
    if (excludeId) conditions.push(ne(users.id, excludeId));

    const user = await this.db
      .select()
      .from(users)
      .where(and(...conditions))
      .get();
    return (user as DBUser) || null;
  }

  async findByPhoneWithPassword(phone: string): Promise<DBUser | null> {
    const user = await this.db.select().from(users).where(eq(users.phoneNumber, phone)).get();
    return (user as DBUser) || null;
  }

  async findByEmailWithPassword(email: string): Promise<DBUser | null> {
    const user = await this.db.select().from(users).where(eq(users.email, email)).get();
    return (user as DBUser) || null;
  }

  async findByEmailAndPhone(email: string, phone: string): Promise<DBUser | null> {
    const user = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.phoneNumber, phone)))
      .get();
    return (user as DBUser) || null;
  }

  async updateStatus(id: string, isActive: boolean): Promise<DBUser | null> {
    const [updated] = await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return (updated as DBUser) || null;
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

  async create(data: Omit<DBUser, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'role' | 'failedLoginAttempts' | 'isLocked' | 'sessionVersion'>): Promise<DBUser> {
    const [created] = await this.db
      .insert(users)
      .values({
        ...data,
        id: randomUUIDv7(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        role: 'user',
        failedLoginAttempts: 0,
        isLocked: false,
        sessionVersion: 1
      })
      .returning();
    return created as DBUser;
  }

  async update(id: string, data: Partial<DBUser>): Promise<DBUser | null> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return (updated as DBUser) || null;
  }

  async getUsersForNotifications(userIds: string[]): Promise<UserWithNotifications[]> {
    if (userIds.length === 0) return [];
    
    // Simplified fetch - in real app would include settings
    const results = await this.db
      .select()
      .from(users)
      .where(inArray(users.id, userIds))
      .all();
    
    return results.map(u => ({
      id: u.id,
      email: u.email,
      phoneNumber: u.phoneNumber,
      pushSubscription: (u as { pushSubscription?: string }).pushSubscription
    })) as UserWithNotifications[];
  }
}
