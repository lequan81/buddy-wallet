/**
 * Services Index
 *
 * Central export point for all services.
 * Exports singleton instances for use outside DI context (worker, scripts).
 *
 * NOTE: Controllers should use the DI plugin (servicesPlugin) instead.
 */
import { db } from '@repo/db';

// Import Service Classes
import { SessionService as SessionServiceClass } from './user/session.service';
import { UserService as UserServiceClass } from './user/user.service';
import { ExportService as ExportServiceClass } from './import-export/export.service';
import { ImportService as ImportServiceClass } from './import-export/import.service';
import { FileService as FileServiceClass } from './storage/file.service';
import { EmailService as EmailServiceClass } from './email/email.service';
import { PushService as PushServiceClass } from './notification/push.service';
import { ActivityService as ActivityServiceClass } from './activity/activity.service';
import { BankAccountService as BankAccountServiceClass } from './bank/bank-account.service';
import { EmailVerificationService as EmailVerificationServiceClass } from './email/email-verification.service';
import { PasswordResetService as PasswordResetServiceClass } from './email/password-reset.service';
import { VietQRService as VietQRServiceClass } from './bank/vietqr.service';
import { JobsService as JobsServiceClass } from './system/jobs.service';
import { SpreadsheetService as SpreadsheetServiceClass } from './import-export/spreadsheet.service';
import { ImportLoggerService as ImportLoggerServiceClass } from './import-export/import-logger.service';

export { CleanupService } from './system/cleanup.service';

// Re-export types from centralized type system
export type { DbClient, JwtService, CacheService } from '../types';

// Singleton instances (for non-DI contexts: worker, scripts, cron)
export const SessionService = new SessionServiceClass(db);
export const PushService = new PushServiceClass(db);
export const ActivityService = new ActivityServiceClass(db);
export const UserService = new UserServiceClass(db);
export const EmailVerificationService = new EmailVerificationServiceClass(db);
export const EmailService = new EmailServiceClass();
export const PasswordResetService = new PasswordResetServiceClass(db, EmailService);
export const VietqrService = new VietQRServiceClass();
export const JobsService = new JobsServiceClass();
export const SpreadsheetService = new SpreadsheetServiceClass();
export const ImportLoggerService = new ImportLoggerServiceClass(db);
export const ImportService = new ImportServiceClass(db, SpreadsheetService, ImportLoggerService);
export const ExportService = new ExportServiceClass(db);
export const FileService = new FileServiceClass(db);
export const BankAccountService = new BankAccountServiceClass(db);
