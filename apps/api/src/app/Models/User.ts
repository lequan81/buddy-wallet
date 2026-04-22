/**
 * User Domain Model
 *
 * Rich domain entity representing an application user.
 */

export class User {
  constructor(
    public readonly id: string,
    public readonly phoneNumber: string,
    public readonly name: string,
    public readonly role: 'user' | 'admin',
    public readonly email?: string,
    public readonly permissions: string[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly deletedAt?: Date
  ) {}

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.role === 'admin';
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  /**
   * Check if user has all permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((p) => this.permissions.includes(p));
  }

  /**
   * Check if user has any permission
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((p) => this.permissions.includes(p));
  }

  /**
   * Check if user is active
   */
  isActive(): boolean {
    return !this.deletedAt;
  }

  /**
   * Check if user account is verified
   */
  isVerified(): boolean {
    // Could check email verification status
    return !!this.email;
  }
}

