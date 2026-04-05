/**
 * User Service (Class-based with Dependency Injection)
 *
 * Handles user management: listing, retrieval, status changes, profile updates.
 * Uses constructor injection for testability.
 * Implements IUserService interface for LSP compliance.
 */
import { userCache, isRedisAvailable } from '@plugins/redis';
import { toSafeUser } from '@utils';
import type { SafeUser, UserResult, PaginatedResult, IUserService } from '@repo/types';
import type { IUserRepository, ISessionRepository } from '@/types/repositories';

/**
 * UserService class with dependency injection
 * Implements IUserService for LSP compliance
 */
export class UserService implements IUserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly sessionRepo: ISessionRepository
  ) {}

  /**
   * Get all users (admin only) with pagination
   */
  async getAllUsers(
    options: { limit?: number; offset?: number } = {}
  ): Promise<PaginatedResult<SafeUser>> {
    const { limit = 50, offset = 0 } = options;

    // Use parallelized findMany from repository
    const { data: paginatedUsers, total } = await this.userRepo.findMany(limit, offset);

    // Strip passwords and sensitive data
    const safeUsers = paginatedUsers.map(toSafeUser);

    return {
      success: true,
      data: safeUsers,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total
      }
    };
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

    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Strip password and sensitive data
    const safeUser = toSafeUser(user);

    // Cache the user profile
    if (isRedisAvailable()) {
      await userCache.set(userId, safeUser as unknown as Record<string, unknown>);
    }

    return { success: true, user: safeUser as SafeUser };
  }

  /**
   * Toggle user active status and revoke sessions if deactivating
   */
  async toggleUserStatus(userId: string): Promise<UserResult> {
    const targetUser = await this.userRepo.findById(userId);

    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const newStatus = !targetUser.isActive;

    await this.userRepo.updateStatus(userId, newStatus);

    // If deactivating, revoke all active sessions
    if (!newStatus) {
      await this.sessionRepo.revokeActiveSessionsForUser(userId);
    }

    // Invalidate user cache
    if (isRedisAvailable()) {
      await userCache.del(userId);
    }

    // Fetch the updated user to return
    const updatedUser = await this.userRepo.findById(userId);
    const safeUser = toSafeUser(updatedUser!);

    return {
      success: true,
      user: safeUser as SafeUser,
      isActive: newStatus,
      message: newStatus ? 'User activated' : 'User deactivated'
    };
  }

  /**
   * Update user profile (name, email, phoneNumber, notification preferences)
   * SECURITY: Whitelist approach - only allow specific fields to be updated
   */
  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      emailNotificationsEnabled?: boolean;
      pushNotificationsEnabled?: boolean;
    }
  ): Promise<UserResult> {
    // Validate at least one field is provided
    if (
      !updates.name &&
      !updates.email &&
      !updates.phoneNumber &&
      updates.emailNotificationsEnabled === undefined &&
      updates.pushNotificationsEnabled === undefined
    ) {
      return { success: false, error: 'No fields to update' };
    }

    // Get current user to verify they exist
    const currentUser = await this.userRepo.findById(userId);

    if (!currentUser) {
      return { success: false, error: 'User not found' };
    }

    // Check if trying to enable push notifications without verified email
    if (updates.pushNotificationsEnabled === true && !currentUser.emailVerified) {
      return { success: false, error: 'Email verification required to enable push notifications' };
    }

    // Check for phone number uniqueness if being updated
    if (updates.phoneNumber && updates.phoneNumber !== currentUser.phoneNumber) {
      const existingUser = await this.userRepo.findByPhone(updates.phoneNumber, userId);

      if (existingUser) {
        return { success: false, error: 'Phone number already in use' };
      }
    }

    // Check for email uniqueness if being updated
    if (updates.email && updates.email !== currentUser.email) {
      const existingUser = await this.userRepo.findByEmail(updates.email, userId);

      if (existingUser) {
        return { success: false, error: 'Email already in use' };
      }
    }

    // Build update object (whitelist approach)
    const updateData: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      emailNotificationsEnabled?: boolean;
      pushNotificationsEnabled?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date()
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.email) updateData.email = updates.email;
    if (updates.phoneNumber) updateData.phoneNumber = updates.phoneNumber;
    if (updates.emailNotificationsEnabled !== undefined) {
      updateData.emailNotificationsEnabled = updates.emailNotificationsEnabled;
    }
    if (updates.pushNotificationsEnabled !== undefined) {
      updateData.pushNotificationsEnabled = updates.pushNotificationsEnabled;
    }

    // Update user in database
    const updatedUser = await this.userRepo.update(userId, updateData);

    // Invalidate user cache
    if (isRedisAvailable()) {
      await userCache.del(userId);
    }

    if (!updatedUser) {
      return { success: false, error: 'Failed to fetch updated user' };
    }

    const safeUser = toSafeUser(updatedUser);

    return {
      success: true,
      user: safeUser as SafeUser,
      message: 'Profile updated successfully'
    };
  }

  /**
   * Check if user can receive push notifications
   * (Standardized logic used by multiple controllers)
   */
  async canReceivePush(userId: string): Promise<boolean> {
    const result = await this.getUserById(userId);
    if (!result.user) return false;
    
    // Must have verified email AND push enabled
    return result.user.emailVerified === true && result.user.pushNotificationsEnabled === true;
  }
}
