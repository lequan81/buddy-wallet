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
import { RateLimitService } from '../Services/RateLimitService';
import { ImportProcessingService } from '../Services/ImportProcessingService';
import { JobsService } from '../Services/JobsService';
import { HealthService } from '../Services/HealthService';
import { NotificationService } from '../Services/NotificationService';
// Actions
import { CreateDebtAction } from '../Actions/Debt/CreateDebtAction';
import { UpdateDebtAction } from '../Actions/Debt/UpdateDebtAction';
import { DeleteDebtAction } from '../Actions/Debt/DeleteDebtAction';
import { ChangePasswordAction } from "../Actions/Auth/ChangePasswordAction";
import { ClearRateLimitAction } from "../Actions/Auth/ClearRateLimitAction";
import { GetMFAStatusAction } from "../Actions/Auth/GetMFAStatusAction";
import { GetRateLimitResetTimeAction } from "../Actions/Auth/GetRateLimitResetTimeAction";
import { IsRateLimitedAction } from "../Actions/Auth/IsRateLimitedAction";
import { LoginAction } from "../Actions/Auth/LoginAction";
import { LogoutAction } from "../Actions/Auth/LogoutAction";
import { RecordAttemptAction } from "../Actions/Auth/RecordAttemptAction";
import { RegisterAction } from "../Actions/Auth/RegisterAction";
import { GetAllLogsAction } from "../Actions/System/GetAllLogsAction";
import { GetLogsForResourceAction } from "../Actions/System/GetLogsForResourceAction";
import { GetLogsForUserAction } from "../Actions/System/GetLogsForUserAction";
import { GetRecentActivityAction } from "../Actions/System/GetRecentActivityAction";
import { LogAction } from "../Actions/System/LogAction";
import { CanReceivePushAction } from "../Actions/User/CanReceivePushAction";
import { GetAllUsersAction } from "../Actions/User/GetAllUsersAction";
import { GetUserByIdAction } from "../Actions/User/GetUserByIdAction";
import { ToggleUserStatusAction } from "../Actions/User/ToggleUserStatusAction";
import { UpdateProfileAction } from "../Actions/User/UpdateProfileAction";
import { CanSendEmailToAction } from "../Actions/Auth/CanSendEmailToAction";
import { CompleteResetAction } from "../Actions/Auth/CompleteResetAction";
import { CreateOtpAction } from "../Actions/Auth/CreateOtpAction";
import { GetUserSessionsAction } from "../Actions/Auth/GetUserSessionsAction";
import { GetVerificationStatusAction } from "../Actions/Auth/GetVerificationStatusAction";
import { RefreshSessionAction } from "../Actions/Auth/RefreshSessionAction";
import { RequestResetAction } from "../Actions/Auth/RequestResetAction";
import { ResendOtpAction } from "../Actions/Auth/ResendOtpAction";
import { ResetPasswordWithTokenAction } from "../Actions/Auth/ResetPasswordWithTokenAction";
import { RevokeAllSessionsAction } from "../Actions/Auth/RevokeAllSessionsAction";
import { RevokeSessionAction } from "../Actions/Auth/RevokeSessionAction";
import { VerifyOtpAction } from "../Actions/Auth/VerifyOtpAction";
import { AddJobAction } from "../Actions/System/AddJobAction";
import { BroadcastAction } from "../Actions/System/BroadcastAction";
import { CancelJobAction } from "../Actions/System/CancelJobAction";
import { CleanupAction } from "../Actions/System/CleanupAction";
import { ColLetterToIndexAction } from "../Actions/System/ColLetterToIndexAction";
import { DetectColumnMappingAction } from "../Actions/System/DetectColumnMappingAction";
import { GetQueueStatusAction } from "../Actions/System/GetQueueStatusAction";
import { GetStorageConfigReadinessAction } from "../Actions/System/GetStorageConfigReadinessAction";
import { GetStorageLiveReadinessAction } from "../Actions/System/GetStorageLiveReadinessAction";
import { GetSystemHealthAction } from "../Actions/System/GetSystemHealthAction";
import { GetUserSubscriptionsAction } from "../Actions/System/GetUserSubscriptionsAction";
import { GetVapidPublicKeyAction } from "../Actions/System/GetVapidPublicKeyAction";
import { IndexToColLetterAction } from "../Actions/System/IndexToColLetterAction";
import { IsConfiguredAction } from "../Actions/System/IsConfiguredAction";
import { ParseToRowsAction } from "../Actions/System/ParseToRowsAction";
import { SendAction } from "../Actions/System/SendAction";
import { SendDebtConfirmedNotificationAction } from "../Actions/System/SendDebtConfirmedNotificationAction";
import { SendDebtCreatedNotificationAction } from "../Actions/System/SendDebtCreatedNotificationAction";
import { SendNotificationAction } from "../Actions/System/SendNotificationAction";
import { SendOtpAction } from "../Actions/System/SendOtpAction";
import { SendPasswordResetAction } from "../Actions/System/SendPasswordResetAction";
import { SendToUserAction } from "../Actions/System/SendToUserAction";
import { SubscribeAction } from "../Actions/System/SubscribeAction";
import { UnsubscribeAction } from "../Actions/System/UnsubscribeAction";
import { AddBankAccountAction } from "../Actions/Bank/AddBankAccountAction";
import { DeleteBankAccountAction } from "../Actions/Bank/DeleteBankAccountAction";
import { GenerateDebtPaymentQRAction } from "../Actions/Bank/GenerateDebtPaymentQRAction";
import { GenerateQRUrlAction } from "../Actions/Bank/GenerateQRUrlAction";
import { GetBanksAction } from "../Actions/Bank/GetBanksAction";
import { GetUserBankAccountsAction } from "../Actions/Bank/GetUserBankAccountsAction";
import { UpdateBankAccountAction } from "../Actions/Bank/UpdateBankAccountAction";
import { ConfirmDebtAction } from "../Actions/Debt/ConfirmDebtAction";
import { CountActiveDebtsForPhoneAction } from "../Actions/Debt/CountActiveDebtsForPhoneAction";
import { FindByIdAction } from "../Actions/Debt/FindByIdAction";
import { FindByIdsAction } from "../Actions/Debt/FindByIdsAction";
import { FindPotentialDuplicatesAction } from "../Actions/Debt/FindPotentialDuplicatesAction";
import { GetDebtByIdAction } from "../Actions/Debt/GetDebtByIdAction";
import { GetDebtsAction } from "../Actions/Debt/GetDebtsAction";
import { GetRecentContactsAction } from "../Actions/Debt/GetRecentContactsAction";
import { RespondToSuggestionAction } from "../Actions/Debt/RespondToSuggestionAction";
import { SuggestEditAction } from "../Actions/Debt/SuggestEditAction";
import { FindSummaryAction } from "../Actions/Debt/FindSummaryAction";
import { UpdateDebtStatusAction } from "../Actions/Debt/UpdateDebtStatusAction";
import { ExportAllDebtsAction } from "../Actions/Data/ExportAllDebtsAction";
import { ExportUserDebtsAction } from "../Actions/Data/ExportUserDebtsAction";
import { GetLogByIdAction } from "../Actions/Data/GetLogByIdAction";
import { GetLogsAction } from "../Actions/Data/GetLogsAction";
import { GetProgressAction } from "../Actions/Data/GetProgressAction";
import { GetProgressBatchAction } from "../Actions/Data/GetProgressBatchAction";
import { ImportDebtsAction } from "../Actions/Data/ImportDebtsAction";
import { PreviewFileAction } from "../Actions/Data/PreviewFileAction";
import { StreamUserDebtsAsCSVAction } from "../Actions/Data/StreamUserDebtsAsCSVAction";
import { UpdateLogStatusAction } from "../Actions/Data/UpdateLogStatusAction";
import { ApproveProofAction } from "../Actions/Storage/ApproveProofAction";
import { DeleteFileAction } from "../Actions/Storage/DeleteFileAction";
import { GetFileAction } from "../Actions/Storage/GetFileAction";
import { GetPendingProofsAction } from "../Actions/Storage/GetPendingProofsAction";
import { GetProofsForDebtAction } from "../Actions/Storage/GetProofsForDebtAction";
import { GetUserQRCodesAction } from "../Actions/Storage/GetUserQRCodesAction";
import { RejectProofAction } from "../Actions/Storage/RejectProofAction";
import { UploadFileAction } from "../Actions/Storage/UploadFileAction";
import { FileService } from "../Services/FileService";
import { S3StorageService } from "../Services/S3StorageService";

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
    container.register(CreateDebtAction, { useClass: CreateDebtAction });
    container.register(UpdateDebtAction, { useClass: UpdateDebtAction });
    container.register(DeleteDebtAction, { useClass: DeleteDebtAction });
    container.register(RateLimitService, { useClass: RateLimitService });
    container.register(ImportProcessingService, { useClass: ImportProcessingService });
    container.register(JobsService, { useClass: JobsService });
    container.register(HealthService, { useClass: HealthService });
    container.register('NotificationService', { useClass: NotificationService });
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
      useValue: new S3StorageService(
        globalS3Client,
        'uploads',
        STORAGE_CONFIG.BUCKET!, 
        toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL)
      )
    });
    container.register('ProofStorage', {
      useValue: new S3StorageService(
        globalS3Client,
        'proofs',
        STORAGE_CONFIG.BUCKET!, 
        toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL)
      )
    });
      container.register(ChangePasswordAction, { useClass: ChangePasswordAction });
      container.register(ClearRateLimitAction, { useClass: ClearRateLimitAction });
      container.register(GetMFAStatusAction, { useClass: GetMFAStatusAction });
      container.register(GetRateLimitResetTimeAction, { useClass: GetRateLimitResetTimeAction });
      container.register(IsRateLimitedAction, { useClass: IsRateLimitedAction });
      container.register(LoginAction, { useClass: LoginAction });
      container.register(LogoutAction, { useClass: LogoutAction });
      container.register(RecordAttemptAction, { useClass: RecordAttemptAction });
      container.register(RegisterAction, { useClass: RegisterAction });
      container.register(GetAllLogsAction, { useClass: GetAllLogsAction });
      container.register(GetLogsForResourceAction, { useClass: GetLogsForResourceAction });
      container.register(GetLogsForUserAction, { useClass: GetLogsForUserAction });
      container.register(GetRecentActivityAction, { useClass: GetRecentActivityAction });
      container.register(LogAction, { useClass: LogAction });
      container.register(CanReceivePushAction, { useClass: CanReceivePushAction });
      container.register(GetAllUsersAction, { useClass: GetAllUsersAction });
      container.register(GetUserByIdAction, { useClass: GetUserByIdAction });
      container.register(ToggleUserStatusAction, { useClass: ToggleUserStatusAction });
      container.register(UpdateProfileAction, { useClass: UpdateProfileAction });
      container.register(CanSendEmailToAction, { useClass: CanSendEmailToAction });
      container.register(CompleteResetAction, { useClass: CompleteResetAction });
      container.register(CreateOtpAction, { useClass: CreateOtpAction });
      container.register(GetUserSessionsAction, { useClass: GetUserSessionsAction });
      container.register(GetVerificationStatusAction, { useClass: GetVerificationStatusAction });
      container.register(RefreshSessionAction, { useClass: RefreshSessionAction });
      container.register(RequestResetAction, { useClass: RequestResetAction });
      container.register(ResendOtpAction, { useClass: ResendOtpAction });
      container.register(ResetPasswordWithTokenAction, { useClass: ResetPasswordWithTokenAction });
      container.register(RevokeAllSessionsAction, { useClass: RevokeAllSessionsAction });
      container.register(RevokeSessionAction, { useClass: RevokeSessionAction });
      container.register(VerifyOtpAction, { useClass: VerifyOtpAction });
      container.register(AddJobAction, { useClass: AddJobAction });
      container.register(BroadcastAction, { useClass: BroadcastAction });
      container.register(CancelJobAction, { useClass: CancelJobAction });
      container.register(CleanupAction, { useClass: CleanupAction });
      container.register(ColLetterToIndexAction, { useClass: ColLetterToIndexAction });
      container.register(DetectColumnMappingAction, { useClass: DetectColumnMappingAction });
      container.register(GetQueueStatusAction, { useClass: GetQueueStatusAction });
      container.register(GetStorageConfigReadinessAction, { useClass: GetStorageConfigReadinessAction });
      container.register(GetStorageLiveReadinessAction, { useClass: GetStorageLiveReadinessAction });
      container.register(GetSystemHealthAction, { useClass: GetSystemHealthAction });
      container.register(GetUserSubscriptionsAction, { useClass: GetUserSubscriptionsAction });
      container.register(GetVapidPublicKeyAction, { useClass: GetVapidPublicKeyAction });
      container.register(IndexToColLetterAction, { useClass: IndexToColLetterAction });
      container.register(IsConfiguredAction, { useClass: IsConfiguredAction });
      container.register(ParseToRowsAction, { useClass: ParseToRowsAction });
      container.register(SendAction, { useClass: SendAction });
      container.register(SendDebtConfirmedNotificationAction, { useClass: SendDebtConfirmedNotificationAction });
      container.register(SendDebtCreatedNotificationAction, { useClass: SendDebtCreatedNotificationAction });
      container.register(SendNotificationAction, { useClass: SendNotificationAction });
      container.register(SendOtpAction, { useClass: SendOtpAction });
      container.register(SendPasswordResetAction, { useClass: SendPasswordResetAction });
      container.register(SendToUserAction, { useClass: SendToUserAction });
      container.register(SubscribeAction, { useClass: SubscribeAction });
      container.register(UnsubscribeAction, { useClass: UnsubscribeAction });
      container.register(AddBankAccountAction, { useClass: AddBankAccountAction });
      container.register(DeleteBankAccountAction, { useClass: DeleteBankAccountAction });
      container.register(GenerateDebtPaymentQRAction, { useClass: GenerateDebtPaymentQRAction });
      container.register(GenerateQRUrlAction, { useClass: GenerateQRUrlAction });
      container.register(GetBanksAction, { useClass: GetBanksAction });
      container.register(GetUserBankAccountsAction, { useClass: GetUserBankAccountsAction });
      container.register(UpdateBankAccountAction, { useClass: UpdateBankAccountAction });
      container.register(ConfirmDebtAction, { useClass: ConfirmDebtAction });
      container.register(CountActiveDebtsForPhoneAction, { useClass: CountActiveDebtsForPhoneAction });
      container.register(FindByIdAction, { useClass: FindByIdAction });
      container.register(FindByIdsAction, { useClass: FindByIdsAction });
      container.register(FindPotentialDuplicatesAction, { useClass: FindPotentialDuplicatesAction });
      container.register(GetDebtByIdAction, { useClass: GetDebtByIdAction });
      container.register(GetDebtsAction, { useClass: GetDebtsAction });
      container.register(GetRecentContactsAction, { useClass: GetRecentContactsAction });
      container.register(RespondToSuggestionAction, { useClass: RespondToSuggestionAction });
      container.register(SuggestEditAction, { useClass: SuggestEditAction });
      container.register(FindSummaryAction, { useClass: FindSummaryAction });
      container.register(UpdateDebtStatusAction, { useClass: UpdateDebtStatusAction });
      container.register(ExportAllDebtsAction, { useClass: ExportAllDebtsAction });
      container.register(ExportUserDebtsAction, { useClass: ExportUserDebtsAction });
      container.register(GetLogByIdAction, { useClass: GetLogByIdAction });
      container.register(GetLogsAction, { useClass: GetLogsAction });
      container.register(GetProgressAction, { useClass: GetProgressAction });
      container.register(GetProgressBatchAction, { useClass: GetProgressBatchAction });
      container.register(ImportDebtsAction, { useClass: ImportDebtsAction });
      container.register(PreviewFileAction, { useClass: PreviewFileAction });
      container.register(StreamUserDebtsAsCSVAction, { useClass: StreamUserDebtsAsCSVAction });
      container.register(UpdateLogStatusAction, { useClass: UpdateLogStatusAction });
      container.register(ApproveProofAction, { useClass: ApproveProofAction });
      container.register(DeleteFileAction, { useClass: DeleteFileAction });
      container.register(GetFileAction, { useClass: GetFileAction });
      container.register(GetPendingProofsAction, { useClass: GetPendingProofsAction });
      container.register(GetProofsForDebtAction, { useClass: GetProofsForDebtAction });
      container.register(GetUserQRCodesAction, { useClass: GetUserQRCodesAction });
      container.register(RejectProofAction, { useClass: RejectProofAction });
      container.register(UploadFileAction, { useClass: UploadFileAction });
      container.register(FileService, { useClass: FileService });

  }


  /**
   * Boot logic that runs after all registrations are complete.
   */
  public async boot(): Promise<void> {
    // Boot event service provider to wire up @OnEvent listeners
    const eventServiceProvider = container.resolve(EventServiceProvider);
    await eventServiceProvider.boot();

    logger.app('AppServiceProvider: Application services registered and booted.');
  }
}

