/**
 * @repo/validation/client - Client-safe validation schemas
 *
 * This entry point ONLY exports schemas that are safe for browser bundles.
 * It does NOT import @repo/db or any server-only dependencies.
 *
 * Use this in apps/web client code:
 *   import { signupSchema } from '@repo/validation/client';
 */

export {
	passwordSchema,
	emailSchema,
	nameSchema,
	phoneSchema,
	signupSchema,
	type SignupInput,
	loginSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	changePasswordSchema
} from './src/auth.js';
export {
	amountSchema,
	amountClientSchema,
	descriptionSchema,
	directionSchema,
	CreateDebtInputSchema,
	CreateDebtClientSchema,
	type CreateDebtInput,
	type CreateDebtClientInput
} from './src/debt.js';
export { accountNumberSchema, accountNameSchema } from './src/bank.js';
export { profileSchema } from './src/profile.js';
export { validateField } from './src/helpers.js';
export * as v from 'valibot';
