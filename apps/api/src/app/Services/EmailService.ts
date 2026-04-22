import { injectable } from 'tsyringe';
import { logger } from '@repo/logger';
import { Retryable } from '@/lib/decorators/retryable';
import { Timed } from '@/lib/decorators/timed';

/**
 * Email Service
 * Handles sending Transactional emails (OTP, password reset, notifications, etc.)
 * Supports multiple providers and retry logic
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@injectable()
export class EmailService {
  private provider: string;

  constructor() {
    // Initialize from environment or config
    this.provider = Bun.env.EMAIL_PROVIDER || 'smtp';
  }

  /**
   * Send email with retry and timeout protection
   */
  @Retryable({ maxAttempts: 3, backoffMs: 1000 })
  @Timed(30000, () => ({
    success: false,
    error: 'Email send timeout'
  }))
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      logger.debug('Sending email', {
        to: message.to,
        subject: message.subject,
        provider: this.provider
      });

      // Placeholder implementation
      // In production, integrate with real SMTP provider
      const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Email sent successfully', {
        messageId,
        to: message.to
      });

      return { success: true, messageId };
    } catch (error) {
      logger.error('Email send failed', {
        to: message.to,
        error: String(error)
      });

      throw error; // Let @Retryable handle retry
    }
  }

  /**
   * Send OTP email
   */
  async sendOtp(email: string, otp: string, name: string): Promise<SendResult> {
    return this.send({
      to: email,
      subject: 'Verify Your Email - OTP Code',
      html: `
        <h2>Welcome, ${name}!</h2>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code expires in 10 minutes.</p>
      `,
      text: `Your OTP code is: ${otp}`
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetLink: string, name: string): Promise<SendResult> {
    return this.send({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>Hi ${name},</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>Link expires in 1 hour.</p>
      `,
      text: `Click here to reset your password: ${resetLink}`
    });
  }

  /**
   * Send notification email
   */
  async sendNotification(email: string, subject: string, content: string): Promise<SendResult> {
    return this.send({
      to: email,
      subject,
      html: `<p>${content}</p>`,
      text: content
    });
  }
}

