/**
 * @repo/validation/client - Client-safe validation schemas
 *
 * This entry point ONLY exports schemas that are safe for browser bundles.
 * It does NOT import @repo/db or any server-only dependencies.
 *
 * Use this in apps/web client code:
 *   import { signupSchema } from '@repo/validation/client';
 */

export * from './src/auth.js';
export * from './src/debt.js';
export * from './src/bank.js';
export * from './src/profile.js';
export * from './src/helpers.js';
export * as v from 'valibot';
export * from 'valibot';
