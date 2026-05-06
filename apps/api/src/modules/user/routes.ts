/**
 * User Routes
 * @logicType http
 *
 * Admin routes use requirePermission('admin:manage-user') for access control.
 */

import { Elysia, t } from 'elysia';
import { UpdateProfileSchema, ChangePasswordSchema, ListUsersQuerySchema } from './schema';
import { profile } from './handlers/profile.handler';
import { admin } from './handlers/admin.handler';
import { requireUser, requirePermission } from '@/commons/http/require-user';

export const userRoutes = new Elysia({ prefix: '/user' })
  .get('/profile', requirePermission('user:view-profile', profile.get), {
    detail: { tags: ['user'], description: 'Get current user profile' }
  })
  .patch('/profile', requirePermission('user:update-profile', profile.update), {
    body: UpdateProfileSchema,
    detail: { tags: ['user'], description: 'Update current user profile' }
  })
  .post('/change-password', requireUser(profile.changePassword), {
    body: ChangePasswordSchema,
    detail: { tags: ['user'], description: 'Change user password' }
  })
  .get('/admin/users', requirePermission('admin:manage-user', admin.listUsers), {
    query: ListUsersQuerySchema,
    detail: { tags: ['user', 'admin'], description: 'List all users (admin only)' }
  })
  .get('/admin/users/:id', requirePermission('admin:manage-user', admin.getUser), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['user', 'admin'], description: 'Get user by ID (admin only)' }
  })
  .patch('/admin/users/:id', requirePermission('admin:manage-user', admin.updateUser), {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      email: t.Optional(t.String()),
      role: t.Optional(t.String()),
      isActive: t.Optional(t.Boolean())
    }),
    detail: { tags: ['user', 'admin'], description: 'Update user (admin only)' }
  })
  .delete('/admin/users/:id', requirePermission('admin:manage-user', admin.deleteUser), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['user', 'admin'], description: 'Delete user (admin only)' }
  });
