/**
 * Services Index
 *
 * Central export point for all services.
 * Exports singleton instances for use in controllers.
 *
 * NOTE: Service classes are NOT re-exported.
 * Tests should import classes directly from specific service files.
 */
import { db } from '@repo/db';

// Import Service Classes (aliased to avoid name collision with singleton exports)
import { AuthService as AuthServiceClass } from './auth.service';
import { SessionService as SessionServiceClass } from './session.service';
import { DebtService as DebtServiceClass } from './debt.service';
import { UserService as UserServiceClass } from './user.service';
import { ExportService as ExportServiceClass } from './export.service';
import { ImportService as ImportServiceClass } from './import.service';
import { FileService as FileServiceClass } from './file.service';
import { EmailService as EmailServiceClass } from './email.service';
import { PushService as PushServiceClass } from './push.service';
import { ActivityService as ActivityServiceClass } from './activity.service';
import { BankAccountService as BankAccountServiceClass } from './bank-account.service';
import { EmailVerificationService as EmailVerificationServiceClass } from './email-verification.service';
import { PasswordResetService as PasswordResetServiceClass } from './password-reset.service';
import { VietQRService as VietQRServiceClass } from './vietqr.service';
import { JobsService as JobsServiceClass } from './jobs.service';
import { SpreadsheetService as SpreadsheetServiceClass } from './spreadsheet.service';
import { ImportLoggerService as ImportLoggerServiceClass } from './import-logger.service';

export { CleanupService } from './cleanup.service';

// Re-export types
export type { DbClient, JwtService, CacheService } from '../types';

// Re-export input/result types
export type { RegisterInput, LoginInput, AuthResult } from '../types';
export type { SessionInfo } from '../types';
export type { CreateDebtInput, DebtResult, StatusUpdateResult } from '../types';
export type { SafeUser, UserResult } from '../types';
export type { ExportFormat, ExportResult } from '../types';
export type { PreviewResult, ImportResult, ProgressResult } from '../types';

// Singleton instances for the main app
export const AuthService = new AuthServiceClass(db);
export const SessionService = new SessionServiceClass(db);
export const DebtService = new DebtServiceClass(db);
export const UserService = new UserServiceClass(db);
export const ExportService = new ExportServiceClass(db);
export const ImportService = new ImportServiceClass(db);
export const FileService = new FileServiceClass(db);
export const PushService = new PushServiceClass(db);
export const ActivityService = new ActivityServiceClass(db);
export const BankAccountService = new BankAccountServiceClass(db);
export const EmailVerificationService = new EmailVerificationServiceClass(db);
export const PasswordResetService = new PasswordResetServiceClass(db);
export const EmailService = new EmailServiceClass();
export const VietqrService = new VietQRServiceClass();
export const JobsService = new JobsServiceClass();
export const SpreadsheetService = new SpreadsheetServiceClass();
export const ImportLoggerService = new ImportLoggerServiceClass(db);

// Connect push service to debt service for notifications
DebtService.setPushService(PushService);
DebtService.setActivityService(ActivityService);

/**
 * Factory functions for creating services with custom dependencies
 * Used for testing with mocks
 */
export function createAuthService(customDb: typeof db) {
  return new AuthServiceClass(customDb);
}

export function createSessionService(customDb: typeof db) {
  return new SessionServiceClass(customDb);
}

export function createDebtService(customDb: typeof db) {
  return new DebtServiceClass(customDb);
}

export function createUserService(customDb: typeof db) {
  return new UserServiceClass(customDb);
}

export function createExportService(customDb: typeof db) {
  return new ExportServiceClass(customDb);
}

export function createImportService(customDb: typeof db) {
  return new ImportServiceClass(customDb);
}

export function createActivityService(customDb: typeof db) {
  return new ActivityServiceClass(customDb);
}

export function createEmailVerificationService(customDb: typeof db) {
  return new EmailVerificationServiceClass(customDb);
}

export function createPasswordResetService(customDb: typeof db) {
  return new PasswordResetServiceClass(customDb);
}

export function createSpreadsheetService() {
  return new SpreadsheetServiceClass();
}

export function createImportLoggerService(customDb: typeof db) {
  return new ImportLoggerServiceClass(customDb);
}
