/**
 * User Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// Update user profile schema
export const UpdateProfileSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
  email: v.optional(v.pipe(v.string(), v.email())),
  avatar: v.optional(v.string())
});

// Change password schema
export const ChangePasswordSchema = v.object({
  currentPassword: v.pipe(v.string(), v.minLength(8)),
  newPassword: v.pipe(v.string(), v.minLength(8))
});

// List users query schema
export const ListUsersQuerySchema = v.object({
  search: v.optional(v.string()),
  page: v.optional(v.pipe(v.number(), v.minValue(1))),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))
});

// Response schemas
export const UserResponseSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.optional(v.string()),
  phoneNumber: v.string(),
  avatar: v.optional(v.string()),
  role: v.string(),
  permissions: v.array(v.string()),
  isActive: v.boolean(),
  emailVerified: v.boolean(),
  phoneVerified: v.boolean(),
  createdAt: v.date(),
  updatedAt: v.optional(v.date())
});

export const UserListResponseSchema = v.object({
  data: v.array(UserResponseSchema),
  meta: v.object({
    total: v.number(),
    page: v.number(),
    limit: v.number(),
    totalPages: v.number()
  })
});
