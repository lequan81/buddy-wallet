/**
 * Canonical service exports.
 * Re-uses the single DI composition graph from services.plugin.ts.
 */
import { services } from '@/plugins/services.plugin';

export type { DbClient, JwtService, CacheService } from '../types';

export const SessionService = services.sessionService;
export const PushService = services.pushService;
export const ActivityService = services.activityService;
export const UserService = services.userService;
export const EmailVerificationService = services.emailVerificationService;
export const EmailService = services.emailService;
export const PasswordResetService = services.passwordResetService;
export const VietqrService = services.vietqrService;
export const JobsService = services.jobsService;
export const SpreadsheetService = services.spreadsheetService;
export const ImportLoggerService = services.importLoggerService;
export const ImportService = services.importService;
export const ExportService = services.exportService;
export const FileService = services.fileService;
export const BankAccountService = services.bankAccountService;
export const DebtService = services.debtService;
