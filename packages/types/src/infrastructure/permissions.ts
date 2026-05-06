/**
 * Application Permissions
 *
 * Defines all permissions in the system with role-based and context-based access control.
 */

export const PERMISSIONS = {
  // Admin permissions
  ADMIN_VIEW: 'admin:view',
  ADMIN_MANAGE_USERS: 'admin:manage-user',
  ADMIN_IMPORT: 'admin:import',
  ADMIN_BROADCAST: 'admin:broadcast',

  // User permissions
  USER_VIEW_PROFILE: 'user:view-profile',
  USER_UPDATE_PROFILE: 'user:update-profile',

  // Debt permissions (context-based - checked against debt ownership)
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
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permissions for new users
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
 * Admin permissions (includes all user permissions)
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
