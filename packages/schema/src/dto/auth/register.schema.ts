import * as v from 'valibot';

export const registerRequestSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2)),
  phoneNumber: v.pipe(v.string(), v.minLength(10)),
  email: v.optional(v.pipe(v.string(), v.email())),
  password: v.pipe(v.string(), v.minLength(8)),
});

export type RegisterRequest = v.InferOutput<typeof registerRequestSchema>;

// Alias for controller imports
export const RegisterSchema = registerRequestSchema;
export type RegisterSchema = RegisterRequest;
