import type { BaseResult } from './base';
import type { User as DBUser } from '@repo/db';

export type CurrentUser = Pick<DBUser, 'id' | 'role' | 'phoneNumber' | 'email'> & { permissions: string[] };

export interface SafeUser extends Omit<
  DBUser,
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

export interface UserResult extends BaseResult {
  user?: SafeUser;
  users?: SafeUser[];
  isActive?: boolean;
  permissions?: string[];
}

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
