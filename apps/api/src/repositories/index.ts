/**
 * Repositories - Index
 * 
 * Exports concrete adapter implementations only.
 * For interfaces (ports), import from '@/types/repositories'.
 */

// Adapters (Drizzle)
export { DebtDrizzleAdapter } from './adapters/debt.drizzle-adapter';
export { UserDrizzleAdapter } from './adapters/user.drizzle-adapter';
export { SessionDrizzleAdapter } from './adapters/session.drizzle-adapter';
export { ActivityDrizzleAdapter } from './adapters/activity.drizzle-adapter';
export { BankAccountDrizzleAdapter } from './adapters/bank-account.drizzle-adapter';
export { NotificationDrizzleAdapter } from './adapters/notification.drizzle-adapter';
export { ImportExportDrizzleAdapter } from './adapters/import-export.drizzle-adapter';
export { FileDrizzleAdapter } from './adapters/file.drizzle-adapter';
export { EmailVerificationDrizzleAdapter } from './adapters/email-verification.drizzle-adapter';
