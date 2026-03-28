import type { CurrentUser } from '@repo/types';

type DebtActorSource = Pick<CurrentUser, 'id' | 'phoneNumber' | 'role' | 'email'> & {
  permissions: unknown;
};

const normalizePermissions = (permissions: unknown): string[] =>
  Array.isArray(permissions)
    ? permissions.filter((permission): permission is string => typeof permission === 'string')
    : [];

export function toCurrentUser(actor: DebtActorSource): CurrentUser {
  return {
    id: actor.id,
    phoneNumber: actor.phoneNumber,
    permissions: normalizePermissions(actor.permissions),
    role: actor.role,
    email: actor.email
  };
}
