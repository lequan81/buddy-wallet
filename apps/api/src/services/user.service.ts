/**
 * User Service (Class-based with Dependency Injection)
 *
 * Handles user management: listing, retrieval, status changes, profile updates.
 * Uses constructor injection for testability.
 * Implements IUserService interface for LSP compliance.
 */
import { users, sessions, eq, and, ne } from '@repo/db';
import { userCache, isRedisAvailable } from '@plugins/redis';
import type { DbClient } from '@/types';
import type { SafeUser, UserResult } from '@/types';
import type { IUserService } from '@/types/interfaces';

/**
 * UserService class with dependency injection
 * Implements IUserService for LSP compliance
 */
export class UserService implements IUserService {
  constructor(private db: DbClient) { }

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

    // Fetch the updated user to return
    const { password, ...safeUser } = (await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get())!;

    return {
      success: true,
      user: safeUser as SafeUser,
      isActive: newStatus,
      message: newStatus ? 'User activated' : 'User deactivated'
    };
  }

  /**
   * Update user profile (name, email, phoneNumber)
   * SECURITY: Whitelist approach - only allow specific fields to be updated
   */
  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      phoneNumber?: string;
    }
  ): Promise<UserResult> {
    // Validate at least one field is provided
    if (!updates.name && !updates.email && !updates.phoneNumber) {
      return { success: false, error: 'No fields to update' };
    }

    // Get current user to verify they exist
    const currentUser = await this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!currentUser) {
      return { success: false, error: 'User not found' };
    }

    // Check for phone number uniqueness if being updated
    if (updates.phoneNumber && updates.phoneNumber !== currentUser.phoneNumber) {
      const existingUser = await this.db
        .select()
        .from(users)
        .where(and(eq(users.phoneNumber, updates.phoneNumber), ne(users.id, userId)))
        .get();

      if (existingUser) {
        return { success: false, error: 'Phone number already in use' };
      }
    }

    // Check for email uniqueness if being updated
    if (updates.email && updates.email !== currentUser.email) {
      const existingUser = await this.db
        .select()
        .from(users)
        .where(and(eq(users.email, updates.email), ne(users.id, userId)))
        .get();

      if (existingUser) {
        return { success: false, error: 'Email already in use' };
      }
    }

    // Build update object (whitelist approach)
    const updateData: { name?: string; email?: string; phoneNumber?: string; updatedAt: Date } = {
      updatedAt: new Date()
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.email) updateData.email = updates.email;
    if (updates.phoneNumber) updateData.phoneNumber = updates.phoneNumber;

    // Update user in database
    await this.db.update(users).set(updateData).where(eq(users.id, userId));

    // Invalidate user cache
    if (isRedisAvailable()) {
      await userCache.del(userId);
    }

    // Fetch the updated user to return
    const updatedUser = await this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!updatedUser) {
      return { success: false, error: 'Failed to fetch updated user' };
    }

    const { password, ...safeUser } = updatedUser;

    return {
      success: true,
      user: safeUser as SafeUser,
      message: 'Profile updated successfully'
    };
  }
}
