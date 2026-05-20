import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import type { EntityIdParams } from '@repo/types/api/common-params';
import type { ListQuery } from '@repo/types/api/common-queries';

import type { UserEntity as User } from '@repo/types/shared/user';
import type { ChangePasswordRequest } from '@repo/types/shared/user';

export type UpdateProfileBody = {
  name?: string;
  email?: string;
  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
};

export type ChangePasswordBody = ChangePasswordRequest;

export type ListUsersQuery = ListQuery;

export type UserIdParams = EntityIdParams;

export type AdminUpdateUserBody = Partial<Pick<User, 'name' | 'email' | 'role' | 'isActive'>>;

export type ProfileGetContext = AuthenticatedHandlerContext;
export type ProfileUpdateContext = AuthenticatedHandlerContext<UpdateProfileBody>;
export type ChangePasswordContext = AuthenticatedHandlerContext<ChangePasswordBody>;
export type AdminListContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListUsersQuery>;
export type AdminGetContext = AuthenticatedHandlerContext<unknown, UserIdParams>;
export type AdminUpdateContext = AuthenticatedHandlerContext<AdminUpdateUserBody, UserIdParams>;
export type AdminDeleteContext = AuthenticatedHandlerContext<unknown, UserIdParams>;


