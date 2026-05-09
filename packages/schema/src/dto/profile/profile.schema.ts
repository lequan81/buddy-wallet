import * as v from 'valibot';
import { phoneSchema, nameSchema, emailSchema } from '../auth/auth-primitives.schema';

/**
 * Profile schema (used for form validation)
 */
export const profileSchema = v.object({
  phoneNumber: phoneSchema,
});

export type ProfileRequest = v.InferOutput<typeof profileSchema>;

/**
 * Update Profile Schema
 */
export const updateProfileSchema = v.object({
  name: v.optional(nameSchema),
  email: v.optional(emailSchema),
  pushNotificationsEnabled: v.optional(v.boolean()),
  emailNotificationsEnabled: v.optional(v.boolean()),
});

export type UpdateProfileRequest = v.InferOutput<typeof updateProfileSchema>;
