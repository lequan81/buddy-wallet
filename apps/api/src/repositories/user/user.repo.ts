import { randomUUIDv7 } from 'bun';
import { users, eq, and, inArray, ne, sql, type SQL } from '@repo/db';
import type { User, DbClient } from '@repo/db';
import type { UserWithNotifications } from '@repo/types';
import { db } from '@/providers/database';
import { t } from 'elysia';
import { TypeCompiler } from '@sinclair/typebox/compiler';

// ── TypeBox Validation Schemas ────────────────────────────────
const InsertUserSchema = t.Object({
  name: t.String({ minLength: 1 }),
  phoneNumber: t.String({ minLength: 10, maxLength: 20 }),
  email: t.Optional(t.Union([t.String(), t.Null()])),
  password: t.String({ minLength: 8 })
});

const insertUserValidator = TypeCompiler.Compile(InsertUserSchema);

/**
 * User Repository
 * Data access layer for user operations
 * No DI container - uses direct db instance
 */
export class UserRepository {
  constructor(private readonly database: DbClient = db) {}

  async findMany(limit: number, offset: number): Promise<{ data: User[]; total: number }> {
    const data = await this.database
      .select()
      .from(users)
      .where(eq(users.isActive, true))
      .limit(limit)
      .offset(offset)
      .all();
    
    const countResult = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true))
      .get();
      
    const total = countResult?.count || 0;
    
    return { data, total };
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];

    return await this.database
      .select()
      .from(users)
      .where(inArray(users.id, ids))
      .all();
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.database.select().from(users).where(and(eq(users.id, id), eq(users.isActive, true))).get();
    return user || null;
  }

  async findByPhone(phone: string, excludeId?: string): Promise<User | null> {
    const conditions: SQL[] = [eq(users.phoneNumber, phone)];
    if (excludeId) conditions.push(ne(users.id, excludeId));

    const user = await this.database
      .select()
      .from(users)
      .where(and(...conditions))
      .get();
    return user || null;
  }

  async findByEmail(email: string, excludeId?: string): Promise<User | null> {
    const conditions: SQL[] = [eq(users.email, email)];
    if (excludeId) conditions.push(ne(users.id, excludeId));

    const user = await this.database
      .select()
      .from(users)
      .where(and(...conditions))
      .get();
    return user || null;
  }

  async findByPhoneWithPassword(phone: string): Promise<User | null> {
    const user = await this.database.select().from(users).where(eq(users.phoneNumber, phone)).get();
    return user || null;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const user = await this.database.select().from(users).where(eq(users.email, email)).get();
    return user || null;
  }

  async findByEmailAndPhone(email: string, phone: string): Promise<User | null> {
    const user = await this.database
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.phoneNumber, phone)))
      .get();
    return user || null;
  }

  async findByTemporaryPassword(tokenHash: string): Promise<User | null> {
    const user = await this.database
      .select()
      .from(users)
      .where(eq(users.temporaryPassword, tokenHash))
      .get();
    return user || null;
  }

  async updateStatus(id: string, isActive: boolean): Promise<User | null> {
    const [updated] = await this.database
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || null;
  }

  async updateLockoutStatus(
    id: string,
    attempts: number,
    isLocked: boolean,
    lockoutUntil: Date | null
  ): Promise<void> {
    await this.database
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
    await this.database
      .update(users)
      .set({
        failedLoginAttempts: 0,
        isLocked: false,
        lockoutUntil: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'role' | 'failedLoginAttempts' | 'isLocked' | 'sessionVersion' | 'lockoutUntil' | 'lastFailedLoginAt' | 'emailVerified' | 'phoneVerified' | 'lastPasswordChangeAt' | 'emailNotificationsEnabled' | 'pushNotificationsEnabled' | 'temporaryPassword' | 'temporaryPasswordExpires' | 'mustChangePassword' | 'temporaryPasswordUsed'>): Promise<User> {
    if (!insertUserValidator.Check(data)) {
      const errors = [...insertUserValidator.Errors(data)];
      throw new Error(`User validation failed: ${errors[0]?.message ?? 'Invalid data'}`);
    }
    const [created] = await this.database
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
    return created;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const [updated] = await this.database
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || null;
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(users).where(eq(users.id, id));
  }

  async getUsersForNotifications(userIds: string[]): Promise<UserWithNotifications[]> {
    if (userIds.length === 0) return [];
    
    const results = await this.database
      .select()
      .from(users)
      .where(inArray(users.id, userIds))
      .all();
    
    return results.map((u: User) => ({
      id: u.id,
      email: u.email,
      phoneNumber: u.phoneNumber,
      pushSubscription: null,
      role: u.role,
      permissions: u.permissions as string[],
      emailVerified: u.emailVerified,
      emailNotificationsEnabled: u.emailNotificationsEnabled,
      pushNotificationsEnabled: u.pushNotificationsEnabled
    })) as UserWithNotifications[];
  }
}
