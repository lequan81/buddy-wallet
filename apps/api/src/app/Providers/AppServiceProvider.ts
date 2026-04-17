import { container } from 'tsyringe';
import { db } from '@repo/db';
import { logger } from '@repo/logger';
import { STORAGE_CONFIG } from '@repo/config';
import { toOptional } from '@repo/utils';

// Event Bus
import { EventServiceProvider } from './EventServiceProvider';

// Repositories
import { UserRepository } from '../Repositories/Database/UserRepository';
import { SessionRepository } from '../Repositories/Database/SessionRepository';
import { DebtRepository } from '../Repositories/Database/DebtRepository';
import { EmailVerificationRepository } from '../Repositories/Database/EmailVerificationRepository';
import { ActivityRepository } from '../Repositories/Database/ActivityRepository';
import { NotificationRepository } from '../Repositories/Database/NotificationRepository';
import { ImportRepository } from '../Repositories/Database/ImportRepository';
import { FileRepository } from '../Repositories/Database/FileRepository';
import { BankAccountRepository } from '../Repositories/Database/BankAccountRepository';

// Services
import { EmailService } from '../Services/EmailService';
import { EmailVerificationService } from '../Services/EmailVerificationService';
import { AuthService } from '../Services/AuthService';
import { AuthSecurityService } from '../Services/AuthSecurityService';
import { AuthSessionService } from '../Services/AuthSessionService';
import { UserService } from '../Services/UserService';
import { SessionService } from '../Services/SessionService';
import { PasswordResetService } from '../Services/PasswordResetService';
import { ActivityService } from '../Services/ActivityService';
import { PushService } from '../Services/PushService';
import { DebtService } from '../Services/DebtService';
import { SpreadsheetService } from '../Services/SpreadsheetService';
import { ImportLoggerService } from '../Services/ImportLoggerService';
import { ImportService } from '../Services/ImportService';
import { ExportService } from '../Services/ExportService';
import { ImageService } from '../Services/ImageService';
import { FileService } from '../Services/FileService';
import { S3StorageService } from '../Services/S3StorageService';
import { BankAccountService } from '../Services/BankAccountService';
import { VietQRService } from '../Services/VietQRService';
import { JobsService } from '../Services/JobsService';

export class AppServiceProvider {
  /**
   * Register all application services and repositories in the DI container.
   */
  public register(): void {
    // 1. Core Dependencies
    container.register('Database', { useValue: db });
    container.register('Logger', { useValue: logger });

    // 1.5 Event Bus
    const eventServiceProvider = new EventServiceProvider();
    eventServiceProvider.register();

    // 2. Repositories
    container.register('UserRepositoryInterface', { useClass: UserRepository });
    container.register('SessionRepositoryInterface', { useClass: SessionRepository });
    container.register('DebtRepositoryInterface', { useClass: DebtRepository });
    container.register('EmailVerificationRepositoryInterface', { useClass: EmailVerificationRepository });
    container.register('ActivityRepositoryInterface', { useClass: ActivityRepository });
    container.register('NotificationRepositoryInterface', { useClass: NotificationRepository });
    container.register('ImportRepositoryInterface', { useClass: ImportRepository });
    container.register('FileRepositoryInterface', { useClass: FileRepository });
    container.register('BankAccountRepositoryInterface', { useClass: BankAccountRepository });

    // 3. Services
    container.register(EmailService, { useClass: EmailService });
    container.register(EmailVerificationService, { useClass: EmailVerificationService });
    container.register(AuthService, { useClass: AuthService });
    container.register(AuthSecurityService, { useClass: AuthSecurityService });
    container.register(AuthSessionService, { useClass: AuthSessionService });
    container.register(UserService, { useClass: UserService });
    container.register(SessionService, { useClass: SessionService });
    container.register(PasswordResetService, { useClass: PasswordResetService });
    container.register(ActivityService, { useClass: ActivityService });
    container.register(PushService, { useClass: PushService });
    container.register(DebtService, { useClass: DebtService });
    container.register(SpreadsheetService, { useClass: SpreadsheetService });
    container.register(ImportLoggerService, { useClass: ImportLoggerService });
    container.register(ImportService, { useClass: ImportService });
    container.register(ExportService, { useClass: ExportService });
    container.register(JobsService, { useClass: JobsService });
    container.register(ImageService, { useClass: ImageService });
    container.register(FileService, { useClass: FileService });
    container.register(BankAccountService, { useClass: BankAccountService });
    container.register(VietQRService, { useClass: VietQRService });


    // 4. Storage Providers (Named)
    const globalS3Client = new Bun.S3Client({
      endpoint: toOptional(STORAGE_CONFIG.ENDPOINT),
      region: toOptional(STORAGE_CONFIG.REGION),
      bucket: toOptional(STORAGE_CONFIG.BUCKET),
      accessKeyId: toOptional(STORAGE_CONFIG.ACCESS_KEY_ID),
      secretAccessKey: toOptional(STORAGE_CONFIG.SECRET_ACCESS_KEY),
      virtualHostedStyle: !STORAGE_CONFIG.FORCE_PATH_STYLE
    });

    container.register('UploadStorage', {
      useValue: new S3StorageService(globalS3Client, 'uploads', STORAGE_CONFIG.BUCKET!, toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL))
    });
    container.register('ProofStorage', {
      useValue: new S3StorageService(globalS3Client, 'proofs', STORAGE_CONFIG.BUCKET!, toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL))
    });
  }


  /**
   * Boot logic that runs after all registrations are complete.
   */
  public boot(): void {
    logger.app('AppServiceProvider: Application services registered and booted.');
  }
}
