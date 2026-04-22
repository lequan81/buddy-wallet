import { injectable, inject } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import { hashToken } from '@/lib/security/password';
import { authConfig } from '@/config/auth';
import type { CreateOtpResult, VerifyOtpResult, ResendOtpResult } from '@/app/Repositories/Contracts/Types/auth';
import type { EmailVerificationRepositoryInterface, UserRepositoryInterface } from '@/app/Repositories/Contracts';
import { logger } from '@repo/logger';

// Configuration aliases for readability
const { OTP } = authConfig;

/**
 * EmailVerificationService class with dependency injection
 */
@injectable()
export class EmailVerificationService {
  constructor(
    @inject('EmailVerificationRepositoryInterface') private readonly emailVerificationRepo: EmailVerificationRepositoryInterface,
    @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface
  ) {}

  /**
   * Generate a 6-digit OTP
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create and store a new OTP for email verification
   */
  async createOtp(userId: string, email: string): Promise<CreateOtpResult> {
    const otp = this.generateOtp();
    const otpHash = await hashToken(otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP.EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing unverified OTPs for this user/email
    await this.emailVerificationRepo.invalidateExisting(userId, email);

    // Create new OTP record
    await this.emailVerificationRepo.create({
      id: randomUUIDv7('base64url'),
      userId,
      email,
      otpHash,
      expiresAt,
      maxAttempts: OTP.MAX_ATTEMPTS
    });

    logger.debug('OTP created', { userId, email });
    return { data: { otp } };
  }

  /**
   * Verify an OTP code and mark email as verified
   */
  async verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    const otpHash = await hashToken(otp);
    const now = new Date();

    // Find the latest unverified OTP for this email
    const verification = await this.emailVerificationRepo.findLatestUnverified(email);

    if (!verification) {
      return { code: 'OTP_NOT_FOUND', error: 'No pending verification found' };
    }

    // Check if expired
    if (verification.expiresAt < now) {
      return { code: 'OTP_EXPIRED', error: 'OTP has expired. Please request a new one.' };
    }

    // Check if max attempts exceeded
    if (verification.attempts >= verification.maxAttempts) {
      return { code: 'OTP_MAX_ATTEMPTS', error: 'Too many attempts. Please request a new OTP.' };
    }

    // Increment attempts
    await this.emailVerificationRepo.updateAttempts(verification.id, verification.attempts + 1);

    // Verify OTP hash
    if (verification.otpHash !== otpHash) {
      const remainingAttempts = verification.maxAttempts - verification.attempts - 1;
      return {
        code: 'OTP_INVALID',
        error: `Invalid OTP. ${remainingAttempts} attempts remaining.`
      };
    }

    // Mark verification as complete
    await this.emailVerificationRepo.markVerified(verification.id);

    // Update user's emailVerified status
    await this.userRepo.update(verification.userId, { emailVerified: true });

    logger.debug('OTP verified successfully', { email });
    return { data: undefined };
  }

  /**
   * Resend OTP with rate limiting
   */
  async resendOtp(userId: string): Promise<ResendOtpResult> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get user to find their email
    const user = await this.userRepo.findById(userId);

    if (!user || !user.email) {
      return { success: false, error: 'User has no email registered' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email is already verified' };
    }

    // Check resend count in last hour
    const recentVerifications = await this.emailVerificationRepo.findAllByUserIdAndEmail(userId, user.email);

    const recentCount = recentVerifications.filter((v: { createdAt: Date }) => v.createdAt > oneHourAgo).length;

    if (recentCount >= OTP.MAX_RESENDS_PER_HOUR) {
      return {
        success: false,
        error: 'Too many OTP requests. Please try again later.',
        retryAfter: 3600 // 1 hour
      };
    }

    // Check cooldown from last send
    const lastVerification = recentVerifications.sort(
      (a: { lastSentAt: Date }, b: { lastSentAt: Date }) => b.lastSentAt.getTime() - a.lastSentAt.getTime()
    )[0];

    if (lastVerification) {
      const secondsSinceLastSend = (now.getTime() - lastVerification.lastSentAt.getTime()) / 1000;

      if (secondsSinceLastSend < OTP.RESEND_COOLDOWN_SECONDS) {
        return {
          success: false,
          error: 'Please wait before requesting a new OTP',
          retryAfter: Math.ceil(OTP.RESEND_COOLDOWN_SECONDS - secondsSinceLastSend)
        };
      }
    }

    // Create new OTP
    return this.createOtp(userId, user.email);
  }

  /**
   * Check if a user can receive email features (debt notifications, 2FA, etc.)
   */
  canSendEmailTo(user: { email?: string | null; emailVerified?: boolean }): boolean {
    return Boolean(user.email && user.emailVerified);
  }

  /**
   * Get verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<{
    email: string | null;
    emailVerified: boolean;
    pendingVerification: boolean;
  }> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { email: null, emailVerified: false, pendingVerification: false };
    }

    // Check if there's a pending verification
    const pendingCount = await this.emailVerificationRepo.getPendingCount(userId);

    return {
      email: user.email,
      emailVerified: user.emailVerified,
      pendingVerification: pendingCount > 0
    };
  }
}



