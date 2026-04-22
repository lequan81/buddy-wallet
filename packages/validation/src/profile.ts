import * as v from 'valibot';
import { phoneSchema, nameSchema, emailSchema } from './auth.js';

export const profileSchema = v.strictObject({
  phoneNumber: phoneSchema
});

/**
 * Update Profile Schema
 */
export const updateProfileSchema = v.strictObject({
  name: v.optional(nameSchema),
  email: v.optional(emailSchema),
  pushNotificationsEnabled: v.optional(v.boolean()),
  emailNotificationsEnabled: v.optional(v.boolean())
});

export type UpdateProfileInput = v.InferInput<typeof updateProfileSchema>;
