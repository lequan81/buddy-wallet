/**
 * Services DI Plugin for ElysiaJS
 *
 * Provides dependency injection using Elysia's decorate() pattern.
 * All services are attached to the context and available in routes.
 *
 * Usage in controllers:
 *   .post('/', async ({ debtService, user, body }) => { ... })
 */
import { Elysia } from 'elysia';
import { db } from '@repo/db';

// Import Service Classes
// Import Service Classes
import { SessionService as SessionServiceClass } from '@/services/user/session.service';
import { UserService as UserServiceClass } from '@/services/user/user.service';
import { ExportService as ExportServiceClass } from '@/services/import-export/export.service';
import { ImportService as ImportServiceClass } from '@/services/import-export/import.service';
import { FileService as FileServiceClass } from '@/services/storage/file.service';
import { EmailService as EmailServiceClass } from '@/services/email/email.service';
import { PushService as PushServiceClass } from '@/services/notification/push.service';
import { ActivityService as ActivityServiceClass } from '@/services/activity/activity.service';
import { BankAccountService as BankAccountServiceClass } from '@/services/bank/bank-account.service';
import { EmailVerificationService as EmailVerificationServiceClass } from '@/services/email/email-verification.service';
import { PasswordResetService as PasswordResetServiceClass } from '@/services/email/password-reset.service';
import { VietQRService as VietQRServiceClass } from '@/services/bank/vietqr.service';
import { JobsService as JobsServiceClass } from '@/services/system/jobs.service';
import { SpreadsheetService as SpreadsheetServiceClass } from '@/services/import-export/spreadsheet.service';
import { ImportLoggerService as ImportLoggerServiceClass } from '@/services/import-export/import-logger.service';

// Auth Services (Split - Phase 6)
import { AuthCoreService } from '@/services/auth/auth-core.service';
import { AuthSecurityService } from '@/services/auth/auth-security.service';
import { AuthSessionService } from '@/services/auth/auth-session.service';

// Debt Service — Hexagonal Architecture
import { DebtService } from '@/services/debt/debt.service';
// Repositories
import { DrizzleDebtRepository } from '@/repositories/adapters/drizzle-debt.repository';
import { DrizzleUserRepository } from '@/repositories/adapters/drizzle-user.repository';
import { DrizzleSessionRepository } from '@/repositories/adapters/drizzle-session.repository';
import { DrizzleActivityRepository } from '@/repositories/adapters/drizzle-activity.repository';
import { DrizzleNotificationRepository } from '@/repositories/adapters/drizzle-notification.repository';
import { DrizzleBankAccountRepository } from '@/repositories/adapters/drizzle-bank-account.repository';
import { DrizzleImportExportRepository } from '@/repositories/adapters/drizzle-import-export.repository';
import { DrizzleFileRepository } from '@/repositories/adapters/drizzle-file.repository';
import { DrizzleEmailVerificationRepository } from '@/repositories/adapters/drizzle-email-verification.repository';

// Activity & Notification (Core Repositories)
const activityRepository = new DrizzleActivityRepository(db);
const notificationRepository = new DrizzleNotificationRepository(db);

const activityService = new ActivityServiceClass(activityRepository);
const pushService = new PushServiceClass(notificationRepository);
const emailService = new EmailServiceClass();

// Debt Service — Single unified service via repository pattern
const debtRepository = new DrizzleDebtRepository(db);
const debtService = new DebtService(debtRepository, pushService, activityService);

// Repositories (Singleton instances)
const userRepository = new DrizzleUserRepository(db);
const sessionRepository = new DrizzleSessionRepository(db);
const bankAccountRepository = new DrizzleBankAccountRepository(db);
const importExportRepository = new DrizzleImportExportRepository(db);
const fileRepository = new DrizzleFileRepository(db);
const emailVerificationRepository = new DrizzleEmailVerificationRepository(db);

// Email Services
const emailVerificationService = new EmailVerificationServiceClass(emailVerificationRepository, userRepository);
const passwordResetService = new PasswordResetServiceClass(userRepository, emailService);

// Auth Services (Split - SRP)
const authCoreService = new AuthCoreService(userRepository, debtRepository, emailService, emailVerificationService);
const authSecurityService = new AuthSecurityService(userRepository, sessionRepository);
const authSessionService = new AuthSessionService(userRepository, sessionRepository);

// Import & Export Services
const spreadsheetService = new SpreadsheetServiceClass();
const importLoggerService = new ImportLoggerServiceClass(importExportRepository);
const importService = new ImportServiceClass(importExportRepository, spreadsheetService, importLoggerService);
const exportService = new ExportServiceClass(debtRepository, userRepository);

// Existing repositories are now initialized above

const sessionService = new SessionServiceClass(sessionRepository, userRepository);
const userService = new UserServiceClass(userRepository, sessionRepository);
const bankAccountService = new BankAccountServiceClass(bankAccountRepository);

const vietqrService = new VietQRServiceClass();
const jobsService = new JobsServiceClass();
const fileService = new FileServiceClass(fileRepository, debtRepository);

// Define the services object for decoration
export const services = {
  // Core services
  sessionService,
  userService,
  exportService,
  importService,
  fileService,
  bankAccountService,
  emailVerificationService,
  passwordResetService,
  emailService,
  pushService,
  activityService,
  vietqrService,
  jobsService,
  spreadsheetService,
  importLoggerService,

  // Debt Service (Hexagonal Architecture)
  debtService,

  // Auth Services (SRP)
  authCoreService,
  authSecurityService,
  authSessionService,
} as const;

/**
 * Elysia plugin that decorates context with all services
 * Usage: app.use(servicesPlugin)
 */
export const servicesPlugin = new Elysia({ name: 'Services' })
  .decorate(services);

// Extend Elysia type definitions for TypeScript support
declare module 'elysia' {
  export interface ElysiaContext {
    sessionService: typeof services.sessionService;
    userService: typeof services.userService;
    exportService: typeof services.exportService;
    fileService: typeof services.fileService;
    bankAccountService: typeof services.bankAccountService;
    emailVerificationService: typeof services.emailVerificationService;
    passwordResetService: typeof services.passwordResetService;
    emailService: typeof services.emailService;
    pushService: typeof services.pushService;
    activityService: typeof services.activityService;
    vietqrService: typeof services.vietqrService;
    jobsService: typeof services.jobsService;
    spreadsheetService: typeof services.spreadsheetService;
    importLoggerService: typeof services.importLoggerService;
    debtService: typeof services.debtService;
    authCoreService: typeof services.authCoreService;
    authSecurityService: typeof services.authSecurityService;
    authSessionService: typeof services.authSessionService;
  }
}
