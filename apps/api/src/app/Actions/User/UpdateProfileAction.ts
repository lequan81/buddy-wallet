import { injectable, inject } from "tsyringe";
import { userCache, isRedisAvailable } from "@infra/Redis";
import { toSafeUser } from "@/lib/mappers/user";
import type { SafeUser, UserResult } from "@repo/types";
import type { UserRepositoryInterface } from "@/app/Repositories/Contracts/UserRepositoryInterface";

@injectable()
export class UpdateProfileAction {
    constructor(@inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface) {
    }

    async execute(userId: string, updates: {
              name?: string;
              email?: string;
              phoneNumber?: string;
              emailNotificationsEnabled?: boolean;
              pushNotificationsEnabled?: boolean;
            }): Promise<UserResult> {
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
}
