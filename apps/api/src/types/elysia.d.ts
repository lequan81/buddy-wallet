import type { SafeUser, JWTPayload } from '@repo/types';
import type { Context } from 'elysia';

/**
 * Base Elysia Context with Actor Extension
 */
export type ElysiaActorContext<B = any, Q = any, P = any> = Omit<Context, 'set' | 'body' | 'query' | 'params'> & {
  actor: SafeUser | null;
  permissions: string[];
  set: Context['set'];
  body: B;
  query: Q;
  params: P;
  jwt: {
    sign(payload: JWTPayload): Promise<string>;
    verify(token: string): Promise<JWTPayload | false>;
  };
  cookie: Record<string, { value: any; set(options: any): void; remove(): void }>;
  server?: any; // Bun server instance
  requestId?: string;
};

/**
 * Authenticated Elysia Context (where actor is guaranteed)
 */
export type AuthenticatedElysiaContext<B = any, Q = any, P = any> = Omit<ElysiaActorContext<B, Q, P>, 'actor'> & {
  actor: SafeUser;
};
