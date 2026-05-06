/**
 * Core User Types
 *
 * Uses a generic User<TInclude, TExclude> pattern with pre-configured variants.
 */

/** All possible user fields */
export interface UserFields {
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

/** Field categories for masking */
export type SensitiveFields =
  | 'password'
  | 'temporaryPassword'
  | 'temporaryPasswordExpires'
  | 'temporaryPasswordUsed';

export type InternalFields =
  | 'isLocked'
  | 'lockoutUntil'
  | 'failedLoginAttempts'
  | 'lastFailedLoginAt'
  | 'phoneVerified'
  | 'sessionVersion'
  | 'lastPasswordChangeAt';

/** Generic user type with configurable field inclusion */
export type User<
  TInclude extends keyof UserFields = keyof UserFields,
  TExclude extends keyof UserFields = never
> = Pick<UserFields, Exclude<TInclude, TExclude>>;

/** Pre-configured user variants */
export type UserEntity = User<keyof UserFields>;

/** API response user type (excludes sensitive and internal fields) */
export type UserResponse = User<keyof UserFields, SensitiveFields | InternalFields | 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown;
};

export type CurrentUser = User<'id' | 'role' | 'phoneNumber' | 'email' | 'permissions'>;

export type UserWithNotifications = User<
  'id' | 'email' | 'role' | 'permissions' | 'phoneNumber' |
  'emailVerified' | 'emailNotificationsEnabled' | 'pushNotificationsEnabled'
>;

/**
 * Result type for user operations
 * Returns either { data: UserResponse } or { code: string, error?: string }
 */
export type UserResult = Result<UserResponse>;

/**
 * Result type for user list operations
 */
export type UserListResult = Result<UserResponse[]>;

/**
 * Result type for session operations
 */
export type SessionsResult = Result<SessionsResponse>;

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
