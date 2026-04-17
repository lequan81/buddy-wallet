/**
 * User Request DTOs
 *
 * Validation schemas for user endpoints.
 */

import { z } from 'zod';

/**
 * Update profile request
 */
export const UpdateProfileRequest = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email').optional(),
  pushNotificationsEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional()
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

/**
 * Pagination query parameters
 */
export const PaginationQuery = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().optional()
});

export type PaginationQuery = z.infer<typeof PaginationQuery>;
