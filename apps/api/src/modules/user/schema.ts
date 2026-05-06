/**
 * User Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Update user profile schema
export const UpdateProfileSchema = t.Object({
  name: t.Optional(t.String({
    minLength: 2,
    maxLength: 100,
    error: 'Name must be between 2 and 100 characters'
  })),
  email: t.Optional(t.String({
    format: 'email',
    error: 'Invalid email address'
  })),
  avatar: t.Optional(t.String())
});

// Change password schema
export const ChangePasswordSchema = t.Object({
  currentPassword: t.String({
    minLength: 8,
    error: 'Current password is required'
  }),
  newPassword: t.String({
    minLength: 8,
    error: 'New password must be at least 8 characters'
  })
});

// List users query schema
export const ListUsersQuerySchema = t.Object({
  search: t.Optional(t.String()),
  page: t.Optional(t.Number({
    minimum: 1,
    default: 1
  })),
  limit: t.Optional(t.Number({
    minimum: 1,
    maximum: 100,
    default: 20
  }))
});

// Response schemas
export const UserResponseSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.Optional(t.String()),
  phoneNumber: t.String(),
  avatar: t.Optional(t.String()),
  role: t.String(),
  permissions: t.Array(t.String()),
  isActive: t.Boolean(),
  emailVerified: t.Boolean(),
  phoneVerified: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Optional(t.Date())
});

export const UserListResponseSchema = t.Object({
  data: t.Array(UserResponseSchema),
  meta: t.Object({
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number()
  })
});
