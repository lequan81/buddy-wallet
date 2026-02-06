/**
 * Services Index
 *
 * Central export point for all services.
 * Provides both class exports and factory functions for creating instances.
 */
import { db } from '@repo/db';

// Service classes (for DI/testing)
export { AuthService } from './auth.service';
export { SessionService } from './session.service';
export { DebtService } from './debt.service';
export { UserService } from './user.service';
export { ExportService } from './export.service';
export { ImportService } from './import.service';
export { PushService } from './push.service';
export { ActivityService } from './activity.service';
export { cleanupService } from './cleanup.service';

// Re-export types
export type { DbClient, JwtService, CacheService } from '@/types';

// Re-export input/result types
export type { RegisterInput, LoginInput, AuthResult } from '@/types';
export type { SessionInfo } from '@/types';
export type { CreateDebtInput, DebtResult, StatusUpdateResult } from '@/types';
export type { SafeUser, UserResult } from '@/types';
export type { ExportFormat, ExportResult } from '@/types';
export type { PreviewResult, ImportResult, ProgressResult } from '@/types';

/**
 * Create default service instances with the real database
 * Used by the main application
 */
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { DebtService } from './debt.service';
import { UserService } from './user.service';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import { FileService } from './file.service';
import { EmailService, emailService } from './email.service';
import { PushService } from './push.service';
import { ActivityService } from './activity.service';
import { BankAccountService } from './bank-account.service';

// Singleton instances for the main app
export const authService = new AuthService(db);
export const sessionService = new SessionService(db);
export const debtService = new DebtService(db);
export const userService = new UserService(db);
export const exportService = new ExportService(db);
export const importService = new ImportService(db);
export const fileService = new FileService(db);
export const pushService = new PushService(db);
export const activityService = new ActivityService(db);
export { EmailService, emailService };
export * from './vietqr.service';
// Consolidated imports
// Exported above
//export { BankAccountService };
export const bankAccountService = new BankAccountService(db);

/**
 * Factory functions for creating services with custom dependencies
 * Used for testing with mocks
 */
export function createAuthService(customDb: typeof db) {
  return new AuthService(customDb);
}

export function createSessionService(customDb: typeof db) {
  return new SessionService(customDb);
}

export function createDebtService(customDb: typeof db) {
  return new DebtService(customDb);
}

export function createUserService(customDb: typeof db) {
  return new UserService(customDb);
}

export function createExportService(customDb: typeof db) {
  return new ExportService(customDb);
}

export function createImportService(customDb: typeof db) {
  return new ImportService(customDb);
}

export function createActivityService(customDb: typeof db) {
  return new ActivityService(customDb);
}
