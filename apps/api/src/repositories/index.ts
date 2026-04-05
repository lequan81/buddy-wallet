/**
 * Repositories - Index
 * 
 * Exports concrete adapter implementations only.
 * For interfaces (ports), import from '@/types/repositories'.
 */

// Adapters
export { DrizzleDebtRepository } from './adapters/drizzle-debt.repository';
export { DrizzleUserRepository } from './adapters/drizzle-user.repository';
export { DrizzleSessionRepository } from './adapters/drizzle-session.repository';
export { DrizzleActivityRepository } from './adapters/drizzle-activity.repository';
export { DrizzleBankAccountRepository } from './adapters/drizzle-bank-account.repository';
export { DrizzleNotificationRepository } from './adapters/drizzle-notification.repository';
export { DrizzleImportExportRepository } from './adapters/drizzle-import-export.repository';
export { DrizzleFileRepository } from './adapters/drizzle-file.repository';
export { DrizzleEmailVerificationRepository } from './adapters/drizzle-email-verification.repository';
