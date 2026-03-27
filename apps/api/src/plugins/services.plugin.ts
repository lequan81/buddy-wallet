/**
 * Services DI Plugin for ElysiaJS
 * 
 * Provides dependency injection using Elysia's decorate() pattern.
 * All services are attached to the context and available in routes.
 * 
 * Usage in controllers:
 *   .post('/', async ({ debtService, user, body }) => { ... })
 * 
 * NOTE: This plugin provides both legacy (combined) services and new (split) services
 * for gradual migration. Prefer using split services for new code.
 */
import { Elysia } from 'elysia';
import { db } from '@repo/db';

// Import Service Classes
import { SessionService as SessionServiceClass } from '../services/session.service';
import { UserService as UserServiceClass } from '../services/user.service';
import { ExportService as ExportServiceClass } from '../services/export.service';
import { ImportService as ImportServiceClass } from '../services/import.service';
import { FileService as FileServiceClass } from '../services/storage/file.service';
import { EmailService as EmailServiceClass } from '../services/email/email.service';
import { PushService as PushServiceClass } from '../services/push.service';
import { ActivityService as ActivityServiceClass } from '../services/activity.service';
import { BankAccountService as BankAccountServiceClass } from '../services/bank-account.service';
import { EmailVerificationService as EmailVerificationServiceClass } from '../services/email/email-verification.service';
import { PasswordResetService as PasswordResetServiceClass } from '../services/email/password-reset.service';
import { VietQRService as VietQRServiceClass } from '../services/vietqr.service';
import { JobsService as JobsServiceClass } from '../services/jobs.service';
import { SpreadsheetService as SpreadsheetServiceClass } from '../services/spreadsheet.service';
import { ImportLoggerService as ImportLoggerServiceClass } from '../services/import-logger.service';

// Import New Split Service Classes (Phase 6)
import { DebtCrudService } from '../services/debt/debt-crud.service';
import { DebtStatusService } from '../services/debt/debt-status.service';
import { DebtBatchService } from '../services/debt/debt-batch.service';
import { AuthCoreService } from '../services/auth/auth-core.service';
import { AuthSecurityService } from '../services/auth/auth-security.service';
import { AuthSessionService } from '../services/auth/auth-session.service';

// Import Repository Pattern (Phase 7)
import { DrizzleDebtRepository } from '../repositories/adapters/drizzle-debt.repository';
import { DebtServiceHex } from '../services/debt-hexagonal.service';

// Create base service instances
const pushService = new PushServiceClass(db);
const activityService = new ActivityServiceClass(db);
const emailService = new EmailServiceClass();

// NEW: Split Debt Services (Phase 6 - SRP)
const debtCrudService = new DebtCrudService(db, pushService, activityService);
const debtStatusService = new DebtStatusService(db, pushService, activityService);
const debtBatchService = new DebtBatchService(db, pushService, activityService);

// NEW: Hexagonal Architecture Service (Phase 7 - Repository Pattern)
const debtRepository = new DrizzleDebtRepository(db);
const debtServiceHex = new DebtServiceHex(debtRepository, pushService, activityService);

// NEW: Split Auth Services (Phase 6 - SRP)
const authCoreService = new AuthCoreService(db, emailService, new EmailVerificationServiceClass(db));
const authSecurityService = new AuthSecurityService(db);
const authSessionService = new AuthSessionService(db);

// Define the services object for decoration
export const services = {
  // Core services
  sessionService: new SessionServiceClass(db),
  userService: new UserServiceClass(db),
  exportService: new ExportServiceClass(db),
  importService: new ImportServiceClass(db),
  fileService: new FileServiceClass(db),
  bankAccountService: new BankAccountServiceClass(db),
  emailVerificationService: new EmailVerificationServiceClass(db),
  passwordResetService: new PasswordResetServiceClass(db),
  emailService,
  pushService,
  activityService,
  vietqrService: new VietQRServiceClass(),
  jobsService: new JobsServiceClass(),
  spreadsheetService: new SpreadsheetServiceClass(),
  importLoggerService: new ImportLoggerServiceClass(db),

  // Split services (Phase 6)
  debtCrudService,
  debtStatusService,
  debtBatchService,
  authCoreService,
  authSecurityService,
  authSessionService,

  // Hexagonal Architecture (Phase 7)
  debtServiceHex,
  debtRepository,
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
    debtCrudService: typeof services.debtCrudService;
    debtStatusService: typeof services.debtStatusService;
    debtBatchService: typeof services.debtBatchService;
    authCoreService: typeof services.authCoreService;
    authSecurityService: typeof services.authSecurityService;
    authSessionService: typeof services.authSessionService;
    debtServiceHex: typeof services.debtServiceHex;
    debtRepository: typeof services.debtRepository;
  }
}
