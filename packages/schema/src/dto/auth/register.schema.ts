import { Type, type Static } from '@sinclair/typebox';

export const registerRequestSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  phoneNumber: Type.String({ minLength: 10 }),
  email: Type.Optional(Type.String({ format: 'email' })),
  password: Type.String({ minLength: 8 })
});

export type RegisterRequest = Static<typeof registerRequestSchema>;

// Alias for controller imports
export const RegisterSchema = registerRequestSchema;
export type RegisterSchema = RegisterRequest;
