/**
 * @repo/validation - Shared Validation Logic
 *
 * All schemas are client-safe (browser-compatible).
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
export * from 'valibot';
