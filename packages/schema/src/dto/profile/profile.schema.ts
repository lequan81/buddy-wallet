import { Type, type Static } from '@sinclair/typebox';
import { phoneSchema, nameSchema, emailSchema } from '../auth/auth-primitives.schema';

/**
 * Profile schema (used for form validation)
 */
export const profileSchema = Type.Object({
  phoneNumber: phoneSchema,
});

export type ProfileRequest = Static<typeof profileSchema>;

/**
 * Update Profile Schema
 */
export const updateProfileSchema = Type.Object({
  name: Type.Optional(nameSchema),
  email: Type.Optional(emailSchema),
  pushNotificationsEnabled: Type.Optional(Type.Boolean()),
  emailNotificationsEnabled: Type.Optional(Type.Boolean()),
});

export type UpdateProfileRequest = Static<typeof updateProfileSchema>;
