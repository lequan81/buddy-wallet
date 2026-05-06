import { Type, type Static } from '@sinclair/typebox';

export const loginRequestSchema = Type.Object({
  email: Type.String(),
  password: Type.String({ minLength: 1 })
});

export type LoginRequest = Static<typeof loginRequestSchema>;

// Alias for controller imports
export const LoginSchema = loginRequestSchema;
export type LoginSchema = LoginRequest;
