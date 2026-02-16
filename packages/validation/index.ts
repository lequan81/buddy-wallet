/**
 * @repo/validation - Shared Validation Logic
 *
 * All schemas are client-safe (browser-compatible).
 *
 * Import specific schemas:
 *   import { signupSchema } from '@repo/validation/auth';
 *
 * Or import everything:
 *   import { signupSchema, CreateDebtInputSchema } from '@repo/validation';
 */

// Auth schemas
export * from './src/auth';

// Debt schemas
export * from './src/debt';

// Re-export valibot utilities
export * from 'valibot';
