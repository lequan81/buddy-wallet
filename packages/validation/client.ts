/**
 * @repo/validation/client - Client-safe validation schemas
 *
 * This entry point ONLY exports schemas that are safe for browser bundles.
 * It does NOT import @repo/db or any server-only dependencies.
 *
 * Use this in apps/web client code:
 *   import { signupSchema } from '@repo/validation/client';
 */

export * from './src/auth';
export * from './src/debt';
export * from './src/bank';
export * from './src/profile';
export * from './src/helpers';
export * as v from 'valibot';
export * from 'valibot';
