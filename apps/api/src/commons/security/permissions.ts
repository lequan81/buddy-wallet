/**
 * Application Permissions — Single Source of Truth
 *
 * Defines all permissions in the system with role-based and context-based access control.
 * Uses template literal types from @repo/types for type-safe permission construction.
 *
 * The PERMISSIONS constant is the runtime source of truth for valid permissions.
 * DEFAULT_USER_PERMISSIONS and ADMIN_PERMISSIONS control what each role actually gets.
 * Handlers must check permissions via hasPermission() — never construct strings directly.
 *
 * @logicType backend
 */

import type { Permission } from '@repo/types/infrastructure/permissions';

export type { Permission };

/**
 * All valid permissions in the system.
 * Uses `satisfies` to ensure every value is a valid Permission type.
 */
export const PERMISSIONS = {
  // Admin-only permissions
  ADMIN_VIEW: 'admin:view',
  ADMIN_MANAGE_USERS: 'admin:manage-user',
  ADMIN_IMPORT: 'admin:import',
  ADMIN_BROADCAST: 'admin:broadcast',

  // User permissions
  USER_VIEW_PROFILE: 'user:view-profile',
  USER_UPDATE_PROFILE: 'user:update-profile',

  // Debt permissions
  DEBT_CREATE: 'debt:create',
  DEBT_VIEW_OWN: 'debt:view-own',
  DEBT_UPDATE_OWN: 'debt:update-own',
  DEBT_DELETE_OWN: 'debt:delete-own',
  DEBT_VIEW_ALL: 'debt:view-all',
  DEBT_DELETE_ALL: 'debt:delete-all',

  // Storage permissions
  STORAGE_UPLOAD: 'storage:upload',
  STORAGE_VIEW_OWN: 'storage:view-own',
  STORAGE_DELETE_OWN: 'storage:delete-own',
  PROOF_UPLOAD: 'proof:upload',
  PROOF_APPROVE: 'proof:approve',
  PROOF_REJECT: 'proof:reject',

  // Bank account permissions
  BANK_CREATE: 'bank:create',
  BANK_VIEW_OWN: 'bank:view-own',
  BANK_UPDATE_OWN: 'bank:update-own',
  BANK_DELETE_OWN: 'bank:delete-own'
} as const satisfies Record<string, Permission>;

/**
 * Default permissions for new users.
 * Users can only manage their own debts and profile.
 */
export const DEFAULT_USER_PERMISSIONS: Permission[] = [
  PERMISSIONS.USER_VIEW_PROFILE,
  PERMISSIONS.USER_UPDATE_PROFILE,
  PERMISSIONS.DEBT_CREATE,
  PERMISSIONS.DEBT_VIEW_OWN,
  PERMISSIONS.DEBT_UPDATE_OWN,
  PERMISSIONS.DEBT_DELETE_OWN,
  PERMISSIONS.STORAGE_UPLOAD,
  PERMISSIONS.STORAGE_VIEW_OWN,
  PERMISSIONS.STORAGE_DELETE_OWN,
  PERMISSIONS.PROOF_UPLOAD,
  PERMISSIONS.BANK_CREATE,
  PERMISSIONS.BANK_VIEW_OWN,
  PERMISSIONS.BANK_UPDATE_OWN,
  PERMISSIONS.BANK_DELETE_OWN
];

/**
 * Admin permissions (includes all user permissions + admin-only).
 * Admins can view/delete all debts and manage users.
 */
export const ADMIN_PERMISSIONS: Permission[] = [
  ...DEFAULT_USER_PERMISSIONS,
  PERMISSIONS.ADMIN_VIEW,
  PERMISSIONS.ADMIN_MANAGE_USERS,
  PERMISSIONS.ADMIN_IMPORT,
  PERMISSIONS.ADMIN_BROADCAST,
  PERMISSIONS.DEBT_VIEW_ALL,
  PERMISSIONS.DEBT_DELETE_ALL,
  PERMISSIONS.PROOF_APPROVE,
  PERMISSIONS.PROOF_REJECT
];

/**
 * Check if user has required permission
 */
export function hasPermission(userPermissions: string[], required: Permission): boolean {
  return userPermissions.includes(required);
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(userPermissions: string[], required: Permission[]): boolean {
  return required.every((permission) => userPermissions.includes(permission));
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(userPermissions: string[], required: Permission[]): boolean {
  return required.some((permission) => userPermissions.includes(permission));
}
