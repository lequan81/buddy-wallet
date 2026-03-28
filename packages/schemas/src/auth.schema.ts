import { t } from 'elysia';
import { SafeUserSchema } from './user.schema';

export const RegisterSchema = t.Object({
  name: t.String({ minLength: 2 }),
  phoneNumber: t.String({ minLength: 10 }),
  email: t.Optional(t.String({ format: 'email' })),
  password: t.String({ minLength: 8 })
});

export const LoginSchema = t.Object({
  email: t.String(),
  password: t.String()
});

export const LoginResponseSchema = t.Object({
  success: t.Boolean(),
  user: SafeUserSchema,
  expiresIn: t.Number(),
  mustChangePassword: t.Optional(t.Boolean())
});
