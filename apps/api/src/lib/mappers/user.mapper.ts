/**
 * User mapper - Transform domain models to API responses
 */

import type { User as UserEntity } from '@repo/db';
import { maskPhoneNumber } from '@repo/utils';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
}

export interface SafeUserResponse {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
}

/**
 * Map database user entity to API response
 */
export function toUserResponse(user: UserEntity): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt
  };
}

/**
 * Map user to safe response (masks sensitive data)
 */
export function toSafeUserResponse(user: UserEntity): SafeUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber ? maskPhoneNumber(user.phoneNumber) : null,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt
  };
}
