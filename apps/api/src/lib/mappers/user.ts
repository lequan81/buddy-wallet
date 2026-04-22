/**
 * User Mapper - Internal Domain Transformations
 * 
 * Handles transformation between Database Entities and internal Domain/Safe objects.
 */
import type { User as UserEntity } from '@repo/db';
import type { SafeUser } from '@repo/types';

/**
 * Map database user entity to internal SafeUser domain object
 * (Strips password and sensitive security fields)
 */
export function toSafeUser(user: UserEntity): SafeUser {
  const {
    password: _password,
    isLocked: _isLocked,
    lockoutUntil: _lockoutUntil,
    failedLoginAttempts: _failedLoginAttempts,
    lastFailedLoginAt: _lastFailedLoginAt,
    phoneVerified: _phoneVerified,
    sessionVersion: _sessionVersion,
    lastPasswordChangeAt: _lastPasswordChangeAt,
    temporaryPassword: _temporaryPassword,
    temporaryPasswordExpires: _temporaryPasswordExpires,
    temporaryPasswordUsed: _temporaryPasswordUsed,
    ...safeUser
  } = user;

  return {
    ...safeUser,
    permissions: user.permissions || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  } as SafeUser;
}

/**
 * Map multiple users to safe domain objects
 */
export function toSafeUserList(users: UserEntity[]): SafeUser[] {
  return users.map(toSafeUser);
}
