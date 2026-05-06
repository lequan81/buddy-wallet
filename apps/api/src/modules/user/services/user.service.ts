/**
 * User Service - Pure Functions
 * @logicType backend
 */

import type { Result } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';

/**
 * Validate user profile data
 */
export function validateProfileData(data: { name?: string; email?: string }): Result<void> {
  if (data.name !== undefined) {
    if (data.name.length < 2 || data.name.length > 100) {
      return { code: BE_ERRORS.NAME_INVALID.code, error: 'Name must be between 2 and 100 characters' };
    }
  }
  if (data.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { code: BE_ERRORS.EMAIL_INVALID.code, error: 'Invalid email address' };
    }
  }
  return { data: undefined };
}

/**
 * Validate password change
 */
export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  isSamePassword: boolean
): Result<void> {
  if (currentPassword.length < 8) {
    return { code: BE_ERRORS.PASSWORD_INVALID.code, error: 'Current password is required' };
  }
  if (newPassword.length < 8) {
    return { code: BE_ERRORS.PASSWORD_INVALID.code, error: 'New password must be at least 8 characters' };
  }
  if (isSamePassword) {
    return { code: BE_ERRORS.PASSWORD_SAME.code, error: 'New password must be different from current password' };
  }
  return { data: undefined };
}
