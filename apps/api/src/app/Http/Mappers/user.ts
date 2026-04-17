/**
 * User data transformation layer
 * Maps between entities and DTOs
 */

import type { UserEntity, SafeUser } from '@repo/types';

/**
 * Convert UserEntity to SafeUser (removes sensitive fields)
 */
export function toSafeUser(user: UserEntity | null): SafeUser | null {
  if (!user) return null;

  const {
    password,
    isLocked,
    lockoutUntil,
    failedLoginAttempts,
    lastFailedLoginAt,
    phoneVerified,
    sessionVersion,
    lastPasswordChangeAt,
    temporaryPassword,
    temporaryPasswordExpires,
    temporaryPasswordUsed,
    createdAt,
    updatedAt,
    permissions,
    ...safeData
  } = user;

  return {
    ...safeData,
    permissions: permissions ?? [],
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

/**
 * Convert array of UserEntity to array of SafeUser
 */
export function toSafeUsers(users: UserEntity[]): SafeUser[] {
  return users.map(toSafeUser).filter((u): u is SafeUser => u !== null);
}

/**
 * Convert UserEntity to a minimal public profile
 */
export function toPublicProfile(user: UserEntity | null): Pick<SafeUser, 'id' | 'name'> | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
  };
}

/**
 * Create a copy of UserEntity without the password field
 * Used for internal operations where full user data is needed but password must be excluded
 */
export function toUserDTO(user: UserEntity | null): Omit<UserEntity, 'password'> | null {
  if (!user) return null;
  const { password, ...userDTO } = user;
  return userDTO;
}
