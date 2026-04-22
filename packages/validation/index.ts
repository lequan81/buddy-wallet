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
	changePasswordSchema,
	verifyOtpSchema,
	resendOtpSchema
} from './src/auth.js';
export {
	amountSchema,
	CreateDebtClientSchema,
	CreateDebtInputSchema,
	debtStatusSchema,
	debtDirectionSchema,
	debtQuerySchema,
	updateDebtStatusSchema,
	type CreateDebtInput,
	type CreateDebtClientInput,
	type DebtStatus,
	type DebtDirection,
	type DebtQueryInput,
	type UpdateDebtStatusInput
} from './src/debt.js';
export { accountNumberSchema, accountNameSchema } from './src/bank.js';
export {
	profileSchema,
	updateProfileSchema,
	type UpdateProfileInput
} from './src/profile.js';
export {
	progressQuerySchema,
	progressBatchSchema,
	importLogsQuerySchema,
	type ProgressQueryInput,
	type ProgressBatchInput,
	type ImportLogsQueryInput
} from './src/import.js';
export {
	uploadQRSchema,
	uploadPaymentProofSchema,
	rejectProofSchema,
	approveProofSchema,
	type UploadQRInput,
	type UploadPaymentProofInput,
	type RejectProofInput,
	type ApproveProofInput
} from './src/storage.js';
export {
	paginationSchema,
	type PaginationInput
} from './src/shared.js';
export { validateField } from './src/helpers.js';
export * from 'valibot';
