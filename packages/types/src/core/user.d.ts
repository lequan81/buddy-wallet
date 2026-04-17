/**
 * Core User Types
 */

export interface UserEntity {
  id: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  password: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  isLocked: boolean;
  lockoutUntil: Date | null;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  sessionVersion: number;
  lastPasswordChangeAt: Date | null;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  temporaryPassword: string | null;
  temporaryPasswordExpires: Date | null;
  mustChangePassword: boolean;
  temporaryPasswordUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CurrentUser = Pick<UserEntity, 'id' | 'role' | 'phoneNumber' | 'email'> & {
  permissions: string[];
};

export interface SafeUser extends Omit<
  UserEntity,
  | 'password'
  | 'isLocked'
  | 'lockoutUntil'
  | 'failedLoginAttempts'
  | 'lastFailedLoginAt'
  | 'phoneVerified'
  | 'sessionVersion'
  | 'lastPasswordChangeAt'
  | 'temporaryPassword'
  | 'temporaryPasswordExpires'
  | 'temporaryPasswordUsed'
  | 'createdAt'
  | 'updatedAt'
  | 'permissions'
> {
  permissions: string[];
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

/**
 * Result type for user operations
 * Returns either { data: SafeUser } or { code: string, error?: string }
 */
export type UserResult = Result<SafeUser>;

/**
 * Result type for user list operations
 */
export type UserListResult = Result<SafeUser[]>;

/**
 * Result type for session operations
 */
export type SessionsResult = Result<SessionsResponse>;

export interface UserWithNotifications {
  id: string;
  email: string | null;
  role: string;
  permissions: string[];
  phoneNumber: string;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

export interface Session {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date | string;
  expiresAt?: Date | string;
  createdAt?: Date | string;
  deviceName?: string | null;
  deviceType?: string | null;
  location?: string | null;
}

export interface SessionsResponse {
  sessions: Session[];
  currentSessionId: string;
}
