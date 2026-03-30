import type { User as DBUser } from '@repo/db';
import type { SafeUser, UserWithNotifications } from '../core/user';
import type { PaginatedResult } from '../api/pagination';

export interface IUserRepository {
  findById(id: string): Promise<DBUser | null>;
  findByPhone(phone: string): Promise<DBUser | null>;
  findByEmail(email: string): Promise<DBUser | null>;
  findByIdentifier(identifier: string): Promise<DBUser | null>;
  findMany(options: { limit?: number; offset?: number }): Promise<PaginatedResult<SafeUser>>;
  count(): Promise<number>;
  create(data: Omit<DBUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<DBUser>;
  update(id: string, data: Partial<DBUser>): Promise<DBUser | null>;
  delete(id: string): Promise<boolean>;
  
  // Security
  incrementFailedAttempts(id: string): Promise<number>;
  resetFailedAttempts(id: string): Promise<void>;
  lockAccount(id: string, lockoutUntil: Date): Promise<void>;
  updateSignInInfo(id: string, ip: string | null): Promise<void>;
  
  // Utils
  findActiveByPhones(phones: string[]): Promise<DBUser[]>;
  updatePermissions(id: string, permissions: string[]): Promise<void>;
  getUsersForNotifications(userIds: string[]): Promise<UserWithNotifications[]>;
}
