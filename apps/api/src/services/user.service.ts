/**
 * User Service (Class-based with Dependency Injection)
 *
 * Handles user management: listing, retrieval, status changes.
 * Uses constructor injection for testability.
 */
import { users, sessions, eq, and } from '@repo/db';
import { userCache, isRedisAvailable } from '@plugins/redis';
import type { DbClient } from '@/types';
import type { SafeUser, UserResult } from '@/types';

/**
 * UserService class with dependency injection
 */
export class UserService {
  constructor(private db: DbClient) {}

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<SafeUser[]> {
    const allUsers = await this.db.select().from(users).all();
    // Strip passwords
    return allUsers.map(({ password, ...u }) => u as SafeUser);
  }

  /**
   * Get a single user by ID with caching
   */
  async getUserById(userId: string): Promise<UserResult> {
    // Try cache first
    if (isRedisAvailable()) {
      const cached = await userCache.get(userId);
      if (cached) {
        return { success: true, user: cached as unknown as SafeUser };
      }
    }

    const user = await this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Strip password
    const { password, ...safeUser } = user;

    // Cache the user profile
    if (isRedisAvailable()) {
      await userCache.set(userId, safeUser);
    }

    return { success: true, user: safeUser as SafeUser };
  }

  /**
   * Toggle user active status and revoke sessions if deactivating
   */
  async toggleUserStatus(userId: string): Promise<UserResult> {
    const targetUser = await this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const newStatus = !targetUser.isActive;

    await this.db
      .update(users)
      .set({ isActive: newStatus, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // If deactivating, revoke all active sessions
    if (!newStatus) {
      await this.db
        .update(sessions)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedReason: 'admin_revoke'
        })
        .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));
    }

    // Invalidate user cache
    if (isRedisAvailable()) {
      await userCache.del(userId);
    }

    return { success: true, isActive: newStatus };
  }
}
