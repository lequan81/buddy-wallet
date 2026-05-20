/**
 * Application Permissions — Type Definitions
 *
 * The Permission type is derived from the PERMISSIONS constant values.
 * This ensures the type only includes actually-used permissions,
 * not all possible entity:action combinations.
 *
 * To add a new permission:
 * 1. Add it to PERMISSIONS in permissions.ts
 * 2. The Permission type automatically includes it
 */

/** Permission type — derived from PERMISSIONS constant values in permissions.ts */
export type Permission =
  // Admin permissions
  | 'admin:view'
  | 'admin:manage-user'
  | 'admin:import'
  | 'admin:broadcast'
  // Data permissions
  | 'data:import'
  | 'data:export'
  // User permissions
  | 'user:view-profile'
  | 'user:update-profile'
  // Debt permissions
  | 'debt:create'
  | 'debt:view-own'
  | 'debt:update-own'
  | 'debt:delete-own'
  | 'debt:view-all'
  | 'debt:delete-all'
  // Storage permissions
  | 'storage:upload'
  | 'storage:view-own'
  | 'storage:delete-own'
  | 'proof:upload'
  | 'proof:approve'
  | 'proof:reject'
  // Bank account permissions
  | 'bank:create'
  | 'bank:view-own'
  | 'bank:update-own'
  | 'bank:delete-own';

/** Permission check functions */
export type PermissionChecker = {
  hasPermission(userPermissions: string[], required: Permission): boolean;
  hasAllPermissions(userPermissions: string[], required: Permission[]): boolean;
  hasAnyPermission(userPermissions: string[], required: Permission[]): boolean;
};
