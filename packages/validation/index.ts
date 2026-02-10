/**
 * @repo/validation - Shared Validation Logic
 *
 * NOTE: This package has two types of schemas:
 * - Client-safe: ./src/auth.ts (only valibot, safe for browser)
 * - Server-only: ./src/debt.ts (uses @repo/db, NOT client-safe)
 *
 * For client/browser code, import specific schemas:
 *   import { signupSchema } from '@repo/validation/auth';
 *
 * For server code, you can import everything:
 *   import { signupSchema, CreateDebtInputSchema } from '@repo/validation';
 */

// Client-safe exports (no @repo/db dependency)
export * from './src/auth';

// Server-only exports (uses @repo/db - DO NOT import in browser code)
export * from './src/debt';

// Re-export valibot utilities
export * from 'valibot';
