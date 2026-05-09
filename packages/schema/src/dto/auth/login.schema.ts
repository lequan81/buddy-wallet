import * as v from 'valibot';

export const loginRequestSchema = v.object({
  email: v.string(),
  password: v.pipe(v.string(), v.minLength(1)),
});

export type LoginRequest = v.InferOutput<typeof loginRequestSchema>;

// Alias for controller imports
export const LoginSchema = loginRequestSchema;
export type LoginSchema = LoginRequest;
