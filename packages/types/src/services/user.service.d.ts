import type { PaginatedResult } from '../api/pagination';
import type { SafeUser, UserResult } from '../core/user';

export interface IUserService {
  getAllUsers(options?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<SafeUser>>;
  getUserById(userId: string): Promise<UserResult>;
  toggleUserStatus(userId: string): Promise<UserResult>;
  updateUserPermissions?(userId: string, permissions: string[]): Promise<UserResult>;
  updateProfile(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      emailNotificationsEnabled?: boolean;
      pushNotificationsEnabled?: boolean;
    }
  ): Promise<UserResult>;
  canReceivePush(userId: string): Promise<boolean>;
}
