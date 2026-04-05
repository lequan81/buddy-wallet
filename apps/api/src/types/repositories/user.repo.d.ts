import type { User as DBUser } from '@repo/db';
import type { UserWithNotifications } from '@repo/types';

export interface IUserRepository {
  findById(id: string): Promise<DBUser | null>;
  findByIds(ids: string[]): Promise<DBUser[]>;
  findByPhone(phone: string, excludeId?: string): Promise<DBUser | null>;
  findByEmail(email: string, excludeId?: string): Promise<DBUser | null>;
  findByIdentifier?(identifier: string): Promise<DBUser | null>;
  findByPhoneWithPassword(phone: string): Promise<DBUser | null>;
  findByEmailWithPassword(email: string): Promise<DBUser | null>;
  findByEmailAndPhone(email: string, phone: string): Promise<DBUser | null>;
  findMany(limit: number, offset: number): Promise<{ data: DBUser[]; total: number }>;
  updateStatus(id: string, isActive: boolean): Promise<DBUser | null>;
  updateLockoutStatus(
    id: string,
    attempts: number,
    isLocked: boolean,
    lockoutUntil: Date | null
  ): Promise<void>;
  resetFailedAttempts(id: string): Promise<void>;
  create(data: Omit<DBUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<DBUser>;
  update(id: string, data: Partial<DBUser>): Promise<DBUser | null>;
  delete?(id: string): Promise<boolean>;
  consumePasswordResetToken?(id: string, currentHash: string, updates: Partial<DBUser>): Promise<boolean>;

  // Security
  incrementFailedAttempts?(id: string): Promise<number>;
  lockAccount?(id: string, lockoutUntil: Date): Promise<void>;
  updateSignInInfo?(id: string, ip: string | null): Promise<void>;

  // Utils
  findActiveByPhones?(phones: string[]): Promise<DBUser[]>;
  updatePermissions?(id: string, permissions: string[]): Promise<void>;
  getUsersForNotifications?(userIds: string[]): Promise<UserWithNotifications[]>;
}
