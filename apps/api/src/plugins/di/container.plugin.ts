import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { AuthService } from '@/app/Services/AuthService';
import { AuthSecurityService } from '@/app/Services/AuthSecurityService';
import { AuthSessionService } from '@/app/Services/AuthSessionService';
import { EmailService } from '@/app/Services/EmailService';
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
import { UserService } from '@/app/Services/UserService';
import { SessionService } from '@/app/Services/SessionService';
import { PasswordResetService } from '@/app/Services/PasswordResetService';
import { ActivityService } from '@/app/Services/ActivityService';
import { PushService } from '@/app/Services/PushService';
import { DebtService } from '@/app/Services/DebtService';
import { ImportService } from '@/app/Services/ImportService';
import { ExportService } from '@/app/Services/ExportService';
import { JobsService } from '@/app/Services/JobsService';

/**
 * DI Container Plugin
 * 
 * Bridges tsyringe DI container with Elysia context.
 * Resolve services from the container and decorate the context.
 */
export const containerPlugin = new Elysia({ name: 'DIContainer' })
  .decorate({
    get authCoreService() {
      return container.resolve(AuthService);
    },
    get authSecurityService() {
      return container.resolve(AuthSecurityService);
    },
    get authSessionService() {
      return container.resolve(AuthSessionService);
    },
    get emailService() {
      return container.resolve(EmailService);
    },
    get emailVerificationService() {
      return container.resolve(EmailVerificationService);
    },
    get userService() {
      return container.resolve(UserService);
    },
    get sessionService() {
      return container.resolve(SessionService);
    },
    get passwordResetService() {
      return container.resolve(PasswordResetService);
    },
    get activityService() {
      return container.resolve(ActivityService);
    },
    get pushService() {
      return container.resolve(PushService);
    },
    get debtService() {
      return container.resolve(DebtService);
    },
    get importService() {
      return container.resolve(ImportService);
    },
    get exportService() {
      return container.resolve(ExportService);
    },
    get jobsService() {
      return container.resolve(JobsService);
    }
  });
