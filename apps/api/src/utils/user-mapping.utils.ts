import type { User } from '@repo/db';
import type { SafeUser } from '../types';

/**
 * Convert a DB User to a SafeUser (stripping sensitive fields)
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    permissions: user.permissions || [],
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    emailNotificationsEnabled: user.emailNotificationsEnabled,
    pushNotificationsEnabled: user.pushNotificationsEnabled,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
