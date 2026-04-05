import type { CurrentUser } from '@repo/types';
import type { DebtActorSource } from '@/types';

export function toCurrentUser(actor: {
  id: string;
  phoneNumber: string;
  role: string;
  email: string | null;
  permissions: string[] | null;
}): CurrentUser {
  return {
    id: actor.id,
    phoneNumber: actor.phoneNumber,
    permissions: actor.permissions ?? [],
    role: actor.role,
    email: actor.email
  };
}
