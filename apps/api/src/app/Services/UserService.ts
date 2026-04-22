import { injectable, inject } from 'tsyringe';
import { userCache, isRedisAvailable } from '@infra/Redis';
import { toSafeUser } from '@/lib/mappers/user';
import type { SafeUser, UserResult, PaginatedResult } from '@repo/types';
import type { UserRepositoryInterface } from '@/app/Repositories/Contracts/UserRepositoryInterface';
import type { SessionRepositoryInterface } from '@/app/Repositories/Contracts/SessionRepositoryInterface';

/**
 * UserService - User profile and account management
 *
 * Handles user-related operations:
 * - User profile retrieval (with Redis caching)
 * - User listing (admin only, paginated)
 * - Account status management (activation/deactivation)
 * - Account deletion (GDPR compliance)
 * - Session invalidation on status changes
 *
 * Security:
 * - Returns SafeUser objects (passwords and sensitive data stripped)
 * - Redis caching for profile lookups (reduces DB load)
 * - Session revocation when accounts are deactivated
 *
 * @example
 * ```typescript
 * // Get user profile
 * const result = await userService.getUserById('user-123');
 * if (result.data) console.log(result.data.name);
 *
 * // Deactivate user
 * await userService.toggleUserStatus('user-123');
 * ```
 */
@injectable()
export class UserService {
  /**
   * Creates an instance of UserService
   * @param userRepo - Repository for user data access
   * @param sessionRepo - Repository for session management (revocation)
   */
  constructor(
    @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface,
    @inject('SessionRepositoryInterface') private readonly sessionRepo: SessionRepositoryInterface
  ) {}

  /**
   * Retrieves all users (admin only)
   *
   * Returns paginated list of safe user objects.
   * Passwords and sensitive data are automatically stripped.
   *
   * @param options - Pagination options
   * @param options.limit - Maximum users per page (default: 50)
   * @param options.offset - Number of users to skip (default: 0)
   * @returns Paginated list of safe user profiles
   * @throws Never throws - returns empty result on error
   * @permission ADMIN required
   */
  async getAllUsers(
    options: { limit?: number; offset?: number } = {}
  ): Promise<PaginatedResult<SafeUser>> {
    const { limit = 50, offset = 0 } = options;

    const { data: paginatedUsers, total } = await this.userRepo.findMany(limit, offset);

    // Strip passwords and sensitive data
    const safeUsers = paginatedUsers.map(toSafeUser);

    return {
      items: safeUsers,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total
      }
    };
  }

  /**
   * Retrieves a user by ID with Redis caching
   *
   * First checks Redis cache, then falls back to database.
   * Caches successful lookups for 1 hour.
   *
   * @param userId - The user's unique identifier
   * @returns Result with SafeUser on success, or error code
   * @throws Never throws - returns Result with error code on failure
   */
  async getUserById(userId: string): Promise<UserResult> {
    // Try cache first
    if (isRedisAvailable()) {
      const cached = await userCache.get(userId) as SafeUser | null;
      if (cached) {
        return { data: cached };
      }
    }

    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { code: 'USER_NOT_FOUND', error: 'User not found' };
    }

    // Strip password and sensitive data
    const safeUser = toSafeUser(user);

    // Cache the user profile
    if (isRedisAvailable()) {
      await userCache.set(userId, safeUser);
    }

    return { data: safeUser };
  }

  /**
   * Toggles a user's active status
   *
   * If deactivating, all active sessions are revoked immediately.
   * This forces re-authentication on next request.
   *
   * @param userId - The user to toggle
   * @returns Result with updated SafeUser, or error code
   * @throws Never throws - returns Result with error code on failure
   * @sideEffect Revokes all sessions if deactivating
   */
  async toggleUserStatus(userId: string): Promise<UserResult> {
    const targetUser = await this.userRepo.findById(userId);

    if (!targetUser) {
      return { code: 'USER_NOT_FOUND', error: 'User not found' };
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

    return { data: safeUser as SafeUser };
  }

  /**
   * Update user profile (name, email, phoneNumber, notification preferences)
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
    // Get current user to verify they exist
    const currentUser = await this.userRepo.findById(userId);

    if (!currentUser) {
      return { code: 'USER_NOT_FOUND', error: 'User not found' };
    }

    // Check if trying to enable push notifications without verified email
    if (updates.pushNotificationsEnabled === true && !currentUser.emailVerified) {
      return { code: 'VERIFICATION_REQUIRED', error: 'Email verification required to enable push notifications' };
    }

    // Check for phone number uniqueness if being updated
    if (updates.phoneNumber && updates.phoneNumber !== currentUser.phoneNumber) {
      const existingUser = await this.userRepo.findByPhone(updates.phoneNumber, userId);
      if (existingUser) {
        return { code: 'PHONE_IN_USE', error: 'Phone number already in use' };
      }
    }

    // Check for email uniqueness if being updated
    if (updates.email && updates.email !== currentUser.email) {
      const existingUser = await this.userRepo.findByEmail(updates.email, userId);
      if (existingUser) {
        return { code: 'EMAIL_IN_USE', error: 'Email already in use' };
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
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
      return { code: 'UPDATE_FAILED', error: 'Failed to update user' };
    }

    return { data: toSafeUser(updatedUser) };
  }

  /**
   * Check if user can receive push notifications
   */
  async canReceivePush(userId: string): Promise<boolean> {
    const result = await this.getUserById(userId);
    if ('code' in result) return false;
    
    // Must have verified email AND push enabled
    return result.data.emailVerified === true && result.data.pushNotificationsEnabled === true;
  }
}

