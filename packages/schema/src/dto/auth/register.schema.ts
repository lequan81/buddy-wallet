import * as v from 'valibot';

export const registerRequestSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2, 'name must be at least 2 characters')),
  phoneNumber: v.pipe(v.string(), v.minLength(10, 'phoneNumber must be at least 10 characters')),
  email: v.optional(v.pipe(v.string(), v.email('invalid email'))),
  password: v.pipe(v.string(), v.minLength(8, 'password must be at least 8 characters'))
});

export type RegisterRequest = v.InferOutput<typeof registerRequestSchema>;

// Alias for controller imports
export const RegisterSchema = registerRequestSchema;
export type RegisterSchema = RegisterRequest;
