import { t } from 'elysia';
import { NullableString, NullableDateString, PaginationSchema } from './common.schema';
export const SafeUserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: NullableString,
  phoneNumber: NullableString,
  role: t.String(),
  permissions: t.Array(t.String()),
  isActive: t.Boolean(),
  emailVerified: t.Optional(t.Boolean()),
  emailNotificationsEnabled: t.Optional(t.Boolean()),
  pushNotificationsEnabled: t.Optional(t.Boolean()),
  mustChangePassword: t.Optional(t.Boolean()),
  createdAt: NullableDateString,
  updatedAt: NullableDateString
});

export const UserResponseSchema = t.Object({
  success: t.Literal(true),
  user: SafeUserSchema
});

export const UsersListResponseSchema = t.Object({
  success: t.Literal(true),
  data: t.Array(SafeUserSchema),
  pagination: PaginationSchema
});

export const UpdateProfileSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  email: t.Optional(t.String({ format: 'email' })),
  phoneNumber: t.Optional(t.String({ pattern: '^\\+?[1-9]\\d{1,14}$' })),
  emailNotificationsEnabled: t.Optional(t.Boolean()),
  pushNotificationsEnabled: t.Optional(t.Boolean())
});
