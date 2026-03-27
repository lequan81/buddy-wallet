/**
 * Services Index
 *
 * Central export point for all services.
 * Exports singleton instances for use in controllers.
 *
 * NOTE: Service classes are NOT re-exported.
 * Tests should import classes directly from specific service files.
 *
 * LEGACY SERVICES (AuthService, DebtService) REMOVED - use split services via DI
 */
import { db } from '@repo/db';

// Import Service Classes (aliased to avoid name collision with singleton exports)
import { SessionService as SessionServiceClass } from './session.service';
import { UserService as UserServiceClass } from './user.service';
import { ExportService as ExportServiceClass } from './export.service';
import { ImportService as ImportServiceClass } from './import.service';
import { FileService as FileServiceClass } from './storage/file.service';
import { EmailService as EmailServiceClass } from './email/email.service';
import { PushService as PushServiceClass } from './push.service';
import { ActivityService as ActivityServiceClass } from './activity.service';
import { BankAccountService as BankAccountServiceClass } from './bank-account.service';
import { EmailVerificationService as EmailVerificationServiceClass } from './email/email-verification.service';
import { PasswordResetService as PasswordResetServiceClass } from './email/password-reset.service';
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

// Singleton instances for the main app (legacy exports removed, use DI)
export const SessionService = new SessionServiceClass(db);
export const PushService = new PushServiceClass(db);
export const ActivityService = new ActivityServiceClass(db);
export const UserService = new UserServiceClass(db);
export const ExportService = new ExportServiceClass(db);
export const ImportService = new ImportServiceClass(db);
export const FileService = new FileServiceClass(db);
export const BankAccountService = new BankAccountServiceClass(db);
export const EmailVerificationService = new EmailVerificationServiceClass(db);
export const PasswordResetService = new PasswordResetServiceClass(db);
export const EmailService = new EmailServiceClass();
export const VietqrService = new VietQRServiceClass();
export const JobsService = new JobsServiceClass();
export const SpreadsheetService = new SpreadsheetServiceClass();
export const ImportLoggerService = new ImportLoggerServiceClass(db);

// NOTE: AuthService and DebtService removed - use split services via DI plugin:
// - authCoreService, authSecurityService, authSessionService
// - debtCrudService, debtStatusService, debtBatchService, debtServiceHex
