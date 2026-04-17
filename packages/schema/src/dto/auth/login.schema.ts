import * as v from 'valibot';

export const loginRequestSchema = v.object({
  email: v.string(),
  password: v.pipe(v.string(), v.minLength(1, 'password is required'))
});

export type LoginRequest = v.InferOutput<typeof loginRequestSchema>;
