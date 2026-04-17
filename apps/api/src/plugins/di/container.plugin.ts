import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { AuthCoreService } from '@/app/Services/auth/auth-core.service';
import { AuthSecurityService } from '@/app/Services/auth/auth-security.service';
import { AuthSessionService } from '@/app/Services/auth/auth-session.service';
import { EmailService } from '@/app/Services/EmailService';
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
import { UserService } from '@/app/Services/user/user.service';
import { SessionService } from '@/app/Services/user/session.service';
import { PasswordResetService } from '@/app/Services/user/PasswordResetService';
import { ActivityService } from '@/app/Services/user/ActivityService';
import { PushService } from '@/app/Services/notification/PushService';
import { DebtService } from '@/app/Services/debt/DebtService';
import { ImportService } from '@/app/Services/import-export/ImportService';
import { ExportService } from '@/app/Services/import-export/ExportService';
import { JobsService } from '@/app/Services/system/JobsService';

/**
 * DI Container Plugin
 * 
 * Bridges tsyringe DI container with Elysia context.
 * Resolve services from the container and decorate the context.
 */
export const containerPlugin = new Elysia({ name: 'DIContainer' })
  .decorate({
    get authCoreService() {
      return container.resolve(AuthCoreService);
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
