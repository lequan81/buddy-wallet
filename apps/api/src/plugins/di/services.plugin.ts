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

// Service Classes
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

// Auth Services
import { AuthCoreService } from '@/services/auth/auth-core.service';
import { AuthSecurityService } from '@/services/auth/auth-security.service';
import { AuthSessionService } from '@/services/auth/auth-session.service';

// Debt Service
import { DebtService } from '@/services/debt/debt.service';

// Repository Adapters (Drizzle)
import { DebtDrizzleAdapter } from '@/repositories/adapters/debt.drizzle-adapter';
import { UserDrizzleAdapter } from '@/repositories/adapters/user.drizzle-adapter';
import { SessionDrizzleAdapter } from '@/repositories/adapters/session.drizzle-adapter';
import { ActivityDrizzleAdapter } from '@/repositories/adapters/activity.drizzle-adapter';
import { NotificationDrizzleAdapter } from '@/repositories/adapters/notification.drizzle-adapter';
import { BankAccountDrizzleAdapter } from '@/repositories/adapters/bank-account.drizzle-adapter';
import { ImportExportDrizzleAdapter } from '@/repositories/adapters/import-export.drizzle-adapter';
import { FileDrizzleAdapter } from '@/repositories/adapters/file.drizzle-adapter';
import { EmailVerificationDrizzleAdapter } from '@/repositories/adapters/email-verification.drizzle-adapter';

// Initialize Repositories (Singleton instances)
const userRepository = new UserDrizzleAdapter(db);
const debtRepository = new DebtDrizzleAdapter(db);
const sessionRepository = new SessionDrizzleAdapter(db);
const activityRepository = new ActivityDrizzleAdapter(db);
const notificationRepository = new NotificationDrizzleAdapter(db);
const bankAccountRepository = new BankAccountDrizzleAdapter(db);
const importExportRepository = new ImportExportDrizzleAdapter(db);
const fileRepository = new FileDrizzleAdapter(db);
const emailVerificationRepository = new EmailVerificationDrizzleAdapter(db);

// Initialize Services
const activityService = new ActivityServiceClass(activityRepository);
const pushService = new PushServiceClass(notificationRepository);
const emailService = new EmailServiceClass();
const debtService = new DebtService(debtRepository, pushService, activityService);

// Email & Auth Services
const emailVerificationService = new EmailVerificationServiceClass(emailVerificationRepository, userRepository);
const passwordResetService = new PasswordResetServiceClass(userRepository, emailService);

const authCoreService = new AuthCoreService(userRepository, debtRepository, emailService, emailVerificationService);
const authSecurityService = new AuthSecurityService(userRepository, sessionRepository);
const authSessionService = new AuthSessionService(userRepository, sessionRepository);

// Import & Export Services
const spreadsheetService = new SpreadsheetServiceClass();
const importLoggerService = new ImportLoggerServiceClass(importExportRepository);
const importService = new ImportServiceClass(importExportRepository, spreadsheetService, importLoggerService);
const exportService = new ExportServiceClass(debtRepository, userRepository);

const sessionService = new SessionServiceClass(sessionRepository, userRepository);
const userService = new UserServiceClass(userRepository, sessionRepository);
const bankAccountService = new BankAccountServiceClass(bankAccountRepository);

const vietqrService = new VietQRServiceClass();
const jobsService = new JobsServiceClass();
const fileService = new FileServiceClass(fileRepository, debtRepository);

// Define the services object for decoration
export const services = {
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
  debtService,
  authCoreService,
  authSecurityService,
  authSessionService,
} as const;

/**
 * Elysia plugin that decorates context with all services
 */
export const servicesPlugin = new Elysia({ name: 'Services' })
  .decorate(services);
