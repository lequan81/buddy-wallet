/**
 * Application Permissions
 *
 * Defines all permissions in the system with role-based and context-based access control.
 */

export const PERMISSIONS: {
  readonly ADMIN_VIEW: 'admin:view';
  readonly ADMIN_MANAGE_USERS: 'admin:manage-users';
  readonly ADMIN_IMPORT: 'admin:import';
  readonly ADMIN_BROADCAST: 'admin:broadcast';
  readonly USER_VIEW_PROFILE: 'user:view-profile';
  readonly USER_UPDATE_PROFILE: 'user:update-profile';
  readonly DEBT_CREATE: 'debt:create';
  readonly DEBT_VIEW_OWN: 'debt:view-own';
  readonly DEBT_UPDATE_OWN: 'debt:update-own';
  readonly DEBT_DELETE_OWN: 'debt:delete-own';
  readonly DEBT_VIEW_ALL: 'debt:view-all';
  readonly DEBT_DELETE_ALL: 'debt:delete-all';
};

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const DEFAULT_USER_PERMISSIONS: Permission[];
export const ADMIN_PERMISSIONS: Permission[];

export function hasPermission(userPermissions: string[], required: Permission): boolean;
export function hasAllPermissions(userPermissions: string[], required: Permission[]): boolean;
export function hasAnyPermission(userPermissions: string[], required: Permission[]): boolean;

