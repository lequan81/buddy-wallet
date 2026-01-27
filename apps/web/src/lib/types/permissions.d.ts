/**
 * Permission Types
 *
 * Server-computed permission flags that CANNOT be tampered
 * with via browser devtools.
 */

export interface AdminPermissions {
  isAdmin: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canImportData: boolean;
  canExportData: boolean;
}
