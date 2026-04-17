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

// Service es - imported from new app/Services structure
import { SessionService } from '@/app/Services/SessionService';
import { UserService } from '@/app/Services/UserService';
import { ExportService } from '@/app/Services/ExportService';
import { ImportService } from '@/app/Services/ImportService';
import { FileService } from '@/app/Services/FileService';
import { EmailService } from '@/app/Services/EmailService';
import { PushService } from '@/app/Services/PushService';
import { ActivityService } from '@/app/Services/ActivityService';
import { BankAccountService } from '@/app/Services/BankAccountService';
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
import { PasswordResetService } from '@/app/Services/PasswordResetService';
import { VietQRService } from '@/app/Services/VietQRService';
import { JobsService } from '@/app/Services/JobsService';
import { SpreadsheetService } from '@/app/Services/SpreadsheetService';
import { ImportLoggerService } from '@/app/Services/ImportLoggerService';

// Auth Services
import { AuthService } from '@/app/Services/AuthService';
import { AuthSecurityService } from '@/app/Services/AuthSecurityService';
import { AuthSessionService } from '@/app/Services/AuthSessionService';

// Debt Service
import { DebtService } from '@/app/Services/DebtService';

// Repository s (Drizzle)
import { UserRepository } from '@/app/Repositories/Database/UserRepository';
import { DebtRepository } from '@/app/Repositories/Database/DebtRepository';
import { SessionRepository } from '@/app/Repositories/Database/SessionRepository';
import { ActivityRepository } from '@/app/Repositories/Database/ActivityRepository';
import { NotificationRepository } from '@/app/Repositories/Database/NotificationRepository';
import { EmailVerificationRepository } from '@/app/Repositories/Database/EmailVerificationRepository';
import { BankAccountRepository } from '@/app/Repositories/Database/BankAccountRepository';
import { ImportRepository } from '@/app/Repositories/Database/ImportRepository';
import { FileRepository } from '@/app/Repositories/Database/FileRepository';

// Initialize Repositories (Singleton instances)
const userRepository = new UserRepository(db);
const debtRepository = new DebtRepository(db);
const sessionRepository = new SessionRepository(db);
const activityRepository = new ActivityRepository(db);
const notificationRepository = new NotificationRepository(db);
const emailVerificationRepository = new EmailVerificationRepository(db);
const bankAccountRepository = new BankAccountRepository();
const importExportRepository = new ImportRepository();
const fileRepository = new FileRepository();

// Initialize Services
const activityService = new ActivityService(activityRepository);
const pushService = new PushService(notificationRepository);
const emailService = new EmailService();
const debtService = new DebtService(debtRepository, pushService, activityService);

// Email & Auth Services
const emailVerificationService = new EmailVerificationService(emailVerificationRepository, userRepository);
const passwordResetService = new PasswordResetService(userRepository, emailService);

const authCoreService = new AuthService(userRepository, debtRepository, emailService, emailVerificationService);
const authSecurityService = new AuthSecurityService(userRepository, sessionRepository);
const authSessionService = new AuthSessionService(userRepository, sessionRepository);

// Import & Export Services
const spreadsheetService = new SpreadsheetService();
const importLoggerService = new ImportLoggerService(importExportRepository);
const importService = new ImportService(importExportRepository, spreadsheetService, importLoggerService);
const exportService = new ExportService(debtRepository, userRepository);

const sessionService = new SessionService(sessionRepository, userRepository);
const userService = new UserService(userRepository, sessionRepository);
const bankAccountService = new BankAccountService(bankAccountRepository);

const vietqrService = new VietQRService();
const jobsService = new JobsService();
const fileService = new FileService(fileRepository, debtRepository);

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
