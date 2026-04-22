/**
 * User Mapper - HTTP Response Formatting
 *
 * Handles transformation between Domain/Entity objects and API response DTOs.
 * Per Laravel convention, this is located in app/Http/Mappers/
 */
import type { User as UserEntity } from '@repo/db';
import type { SafeUser } from '@repo/types';

export interface UserResponse {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export { toSafeUser, toSafeUserList } from '@/lib/mappers/user';

/**
 * Map User to safe API Response (excludes internal IDs, metadata if needed)
 */
export function toUserResponse(user: UserEntity | SafeUser): UserResponse {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    email: user.email || undefined,
    role: user.role || 'user',
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt)
  };
}

/**
 * Map multiple users to safe API Responses
 */
export function toUserListResponse(users: (UserEntity | SafeUser)[]): UserResponse[] {
  return users.map(toUserResponse);
}
