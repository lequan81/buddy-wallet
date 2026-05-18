/**
 * User Profile Handlers (self-service)
 * @logicType http
 */

import { db } from '@/providers/database';
import { UserRepository } from '@/repositories/user/user.repo';
import { SessionRepository } from '@/repositories/auth/session.repo';
import { toUserResponse, verifyPassword, hashPassword } from '@/commons/security/password';
import { BE_ERRORS } from '@repo/errors';
import { validateProfileData, validatePasswordChange } from '../services/user.service';
import type { ChangePasswordContext, ProfileGetContext, ProfileUpdateContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';

const userRepo = new UserRepository(db);

export const profile = {
  /** GET /users/me */
  get: async ({ user }: ProfileGetContext) => {
    const currentUser = await userRepo.findById(user.id);
    if (!currentUser) {
      return apiError(BE_ERRORS.USER_NOT_FOUND);
    }
    return apiSuccess(toUserResponse(currentUser));
  },

  /** PUT /users/me */
  update: async ({ body, user }: ProfileUpdateContext) => {
    const { name, email, pushNotificationsEnabled, emailNotificationsEnabled } = body;

    const validation = validateProfileData({ name, email });
    if ('code' in validation) {
      return apiError(BE_ERRORS.INVALID_INPUT, validation.error);
    }

    if (email && email !== user.email) {
      const existingUser = await userRepo.findByEmail(email);
      if (existingUser) {
        return apiError(BE_ERRORS.AUTH_EMAIL_EXISTS);
      }
    }

    const updateData: Record<string, unknown> = {
      name: name ?? user.name,
      email: email ?? user.email
    };

    if (pushNotificationsEnabled !== undefined) {
      updateData.pushNotificationsEnabled = pushNotificationsEnabled;
    }
    if (emailNotificationsEnabled !== undefined) {
      updateData.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    const updatedUser = await userRepo.update(user.id, updateData);

    return apiSuccess(toUserResponse(updatedUser), 'Profile updated successfully');
  },

  /** PUT /users/me/password */
  changePassword: async ({ body, user, sessionId }: ChangePasswordContext) => {
    const { currentPassword, newPassword } = body;

    const currentUser = await userRepo.findById(user.id);
    if (!currentUser) {
      return apiError(BE_ERRORS.USER_NOT_FOUND);
    }

    const isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser.password);
    if (!isCurrentPasswordValid) {
      return apiError(BE_ERRORS.AUTH_PASSWORD_MISMATCH);
    }

    const isSamePassword = await verifyPassword(newPassword, currentUser.password);
    const validation = validatePasswordChange(currentPassword, newPassword, isSamePassword);
    if ('code' in validation) {
      return apiError(BE_ERRORS.INVALID_INPUT, validation.error);
    }

    const hashedPassword = await hashPassword(newPassword);

    // Transaction: update password + revoke sessions atomically
    await db.transaction(async (tx) => {
      const txUserRepo = new UserRepository(tx);
      const txSessionRepo = new SessionRepository(tx);

      await txUserRepo.update(user.id, {
        password: hashedPassword,
        sessionVersion: (currentUser.sessionVersion || 1) + 1,
        temporaryPasswordUsed: false
      });

      if (sessionId) {
        await txSessionRepo.revokeOthers(user.id, sessionId, 'password_change');
      } else {
        await txSessionRepo.revokeActiveSessionsForUser(user.id);
      }
    });

    return apiSuccess({ changed: true }, 'Password changed successfully');
  }
};
