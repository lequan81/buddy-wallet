/**
 * User Request DTOs
 *
 * Validation schemas for user endpoints using Valibot.
 */

import * as v from 'valibot';
import {
  updateProfileSchema,
  paginationSchema
} from '@repo/validation';

/**
 * Update profile request
 */
export const UpdateProfileRequest = updateProfileSchema;
export type UpdateProfileRequest = v.InferInput<typeof UpdateProfileRequest>;

/**
 * Pagination query parameters
 */
export const PaginationQuery = paginationSchema;
export type PaginationQuery = v.InferInput<typeof PaginationQuery>;

