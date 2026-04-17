/**
 * User Response Mapper
 *
 * Transforms User domain objects to safe API responses.
 */

import type { User } from '@repo/db';

export interface UserResponse {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map User to safe API response (excludes password, sensitive data)
 */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    email: user.email || undefined,
    role: user.role || 'user',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

/**
 * Map multiple users to safe API responses
 */
export function toUserListResponse(users: User[]): UserResponse[] {
  return users.map(toUserResponse);
}
