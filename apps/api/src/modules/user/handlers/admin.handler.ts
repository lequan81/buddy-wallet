/**
 * Admin User Management Handlers
 * @logicType http
 *
 * Permission enforcement is handled at the route level via requirePermission('admin:manage-user').
 * These handlers focus on business logic only.
 */

import { db } from '@/providers/database';
import { UserRepository } from '@/repositories/user/user.repo';
import { toUserResponse } from '@/commons/security/password';
import { BE_ERRORS } from '@repo/errors';
import { calculatePagination } from '@/commons/http/pagination';
import type { AdminDeleteContext, AdminGetContext, AdminListContext, AdminUpdateContext } from '../types/handler.types';
import { apiSuccess, apiError } from '@/commons/http/response';

const userRepo = new UserRepository(db);

export const admin = {
  /** GET /users/:id (admin only) */
  getUser: async ({ params }: AdminGetContext) => {
    const targetUser = await userRepo.findById(params.id);
    if (!targetUser) {
      return apiError(BE_ERRORS.USER_NOT_FOUND);
    }

    return apiSuccess(toUserResponse(targetUser));
  },

  /** GET /users (admin only) */
  listUsers: async ({ query }: AdminListContext) => {
    const { page = 1, limit = 20 } = query;

    const result = await userRepo.findMany(limit, (page - 1) * limit);
    const users = result.data.map((u) => toUserResponse(u));
    return apiSuccess(users, undefined, calculatePagination(result.total, page, limit) as unknown as Record<string, unknown>);
  },

  /** PUT /users/:id (admin only) */
  updateUser: async ({ params, body }: AdminUpdateContext) => {
    const { name, email, role, isActive } = body;

    const targetUser = await userRepo.findById(params.id);
    if (!targetUser) {
      return apiError(BE_ERRORS.USER_NOT_FOUND);
    }

    if (email && email !== targetUser.email) {
      const existingUser = await userRepo.findByEmail(email);
      if (existingUser) {
        return apiError(BE_ERRORS.AUTH_EMAIL_EXISTS);
      }
    }

    const updatedUser = await userRepo.update(params.id, {
      name: name ?? targetUser.name,
      email: email ?? targetUser.email,
      role: role ?? targetUser.role,
      isActive: isActive ?? targetUser.isActive
    });

    return apiSuccess(toUserResponse(updatedUser), 'User updated successfully');
  },

  /** DELETE /users/:id (admin only) */
  deleteUser: async ({ params, user }: AdminDeleteContext) => {
    if (params.id === user.id) {
      return apiError(BE_ERRORS.INVALID_STATE);
    }

    const targetUser = await userRepo.findById(params.id);
    if (!targetUser) {
      return apiError(BE_ERRORS.USER_NOT_FOUND);
    }

    await userRepo.delete(params.id);
    return apiSuccess({ deleted: true }, 'User deleted successfully');
  }
};
