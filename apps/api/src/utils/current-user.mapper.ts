import type { CurrentUser } from '@repo/types';
import type { DebtActorSource } from '@/types';

export function toCurrentUser(actor: DebtActorSource): CurrentUser {
  return {
    id: actor.id,
    phoneNumber: actor.phoneNumber,
    permissions: actor.permissions ?? [],
    role: actor.role,
    email: actor.email
  };
}
