import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';
import type { ListQuery } from '@/types/common-queries';

export interface UpdateProfileBody {
  name?: string;
  email?: string;
  avatar?: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export type ListUsersQuery = ListQuery;

export type UserIdParams = EntityIdParams;

export interface AdminUpdateUserBody {
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export type ProfileGetContext = AuthenticatedHandlerContext;
export type ProfileUpdateContext = AuthenticatedHandlerContext<UpdateProfileBody>;
export type ChangePasswordContext = AuthenticatedHandlerContext<ChangePasswordBody>;
export type AdminListContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListUsersQuery>;
export type AdminGetContext = AuthenticatedHandlerContext<unknown, UserIdParams>;
export type AdminUpdateContext = AuthenticatedHandlerContext<AdminUpdateUserBody, UserIdParams>;
export type AdminDeleteContext = AuthenticatedHandlerContext<unknown, UserIdParams>;
