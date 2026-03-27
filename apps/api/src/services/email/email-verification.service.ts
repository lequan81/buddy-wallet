/**
 * Email Verification Service
 *
 * Handles OTP generation, storage, verification, and rate limiting
 * for email verification flow.
 */
import { randomUUIDv7 } from 'bun';
import { emailVerifications, users, eq, and, desc } from '@repo/db';
import { hashToken } from '@utils';
import type { DbClient } from '@/types';
import type { CreateOtpResult, VerifyOtpResult, ResendOtpResult } from '@/types';

// OTP Configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_RESENDS_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;

/**
 * EmailVerificationService class with dependency injection
 */
export class EmailVerificationService {
  constructor(private db: DbClient) {}

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
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing unverified OTPs for this user/email
    await this.db
      .update(emailVerifications)
      .set({ verified: true }) // Mark as used/expired
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.email, email),
          eq(emailVerifications.verified, false)
        )
      );

    // Create new OTP record
    await this.db.insert(emailVerifications).values({
      id: randomUUIDv7('base64url'),
      userId,
      email,
      otpHash,
      expiresAt,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      verified: false,
      lastSentAt: now,
      createdAt: now
    });

    return { success: true, otp };
  }

  /**
   * Verify an OTP code and mark email as verified
   */
  async verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    const otpHash = await hashToken(otp);
    const now = new Date();

    // Find the latest unverified OTP for this email
    const verification = this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.email, email), eq(emailVerifications.verified, false)))
      .orderBy(desc(emailVerifications.createdAt))
      .get();

    if (!verification) {
      return { success: false, error: 'No pending verification found' };
    }

    // Check if expired
    if (verification.expiresAt < now) {
      return { success: false, error: 'OTP has expired. Please request a new one.' };
    }

    // Check if max attempts exceeded
    if (verification.attempts >= verification.maxAttempts) {
      return { success: false, error: 'Too many attempts. Please request a new OTP.' };
    }

    // Increment attempts
    await this.db
      .update(emailVerifications)
      .set({ attempts: verification.attempts + 1 })
      .where(eq(emailVerifications.id, verification.id));

    // Verify OTP hash
    if (verification.otpHash !== otpHash) {
      const remainingAttempts = verification.maxAttempts - verification.attempts - 1;
      return {
        success: false,
        error: `Invalid OTP. ${remainingAttempts} attempts remaining.`
      };
    }

    // Mark verification as complete
    await this.db
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.id, verification.id));

    // Update user's emailVerified status
    await this.db
      .update(users)
      .set({ emailVerified: true, updatedAt: now })
      .where(eq(users.id, verification.userId));

    return { success: true };
  }

  /**
   * Resend OTP with rate limiting
   */
  async resendOtp(userId: string): Promise<ResendOtpResult> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get user to find their email
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!user || !user.email) {
      return { success: false, error: 'User has no email registered' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email is already verified' };
    }

    // Check resend count in last hour
    const recentVerifications = this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, user.email)))
      .all();

    const recentCount = recentVerifications.filter((v: typeof emailVerifications.$inferSelect) => v.createdAt > oneHourAgo).length;

    if (recentCount >= OTP_MAX_RESENDS_PER_HOUR) {
      return {
        success: false,
        error: 'Too many OTP requests. Please try again later.',
        retryAfter: 3600 // 1 hour
      };
    }

    // Check cooldown from last send
    const lastVerification = recentVerifications.sort(
      (a: typeof emailVerifications.$inferSelect, b: typeof emailVerifications.$inferSelect) => b.lastSentAt.getTime() - a.lastSentAt.getTime()
    )[0];

    if (lastVerification) {
      const secondsSinceLastSend = (now.getTime() - lastVerification.lastSentAt.getTime()) / 1000;

      if (secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS) {
        return {
          success: false,
          error: 'Please wait before requesting a new OTP',
          retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend)
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
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();

    if (!user) {
      return { email: null, emailVerified: false, pendingVerification: false };
    }

    // Check if there's a pending verification
    const pendingVerification = this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.verified, false)))
      .get();

    return {
      email: user.email,
      emailVerified: user.emailVerified,
      pendingVerification: Boolean(
        pendingVerification && pendingVerification.expiresAt > new Date()
      )
    };
  }
}

// Singleton instance for the main app
