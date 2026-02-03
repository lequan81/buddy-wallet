/**
 * Email Service (@upyo/smtp)
 *
 * Sends transactional emails via Gmail SMTP with connection pooling.
 * Supports two sender aliases: noreply and support.
 */
import { SmtpTransport } from '@upyo/smtp';
import { createMessage } from '@upyo/core';
import { log } from '@utils/logger';

type EmailFrom = 'noreply' | 'support';

const FROM_ADDRESSES: Record<EmailFrom, string> = {
  noreply: Bun.env.SMTP_FROM_NOREPLY || 'no-reply@buddywallet.dpdns.org',
  support: Bun.env.SMTP_FROM_SUPPORT || 'support@buddywallet.dpdns.org'
};

export class EmailService {
  private transport: SmtpTransport | null = null;

  private getTransport(): SmtpTransport {
    if (!this.transport) {
      this.transport = new SmtpTransport({
        host: Bun.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(Bun.env.SMTP_PORT) || 587,
        secure: false, // TLS (STARTTLS) - starts plain, upgrades to encrypted
        auth: {
          user: Bun.env.SMTP_USER!,
          pass: Bun.env.SMTP_PASS!
        },
        pool: true,
        poolSize: 5
      });
    }
    return this.transport;
  }

  /**
   * Send a generic email
   */
  async send(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: EmailFrom;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromAddr = FROM_ADDRESSES[options.from || 'noreply'];

    const message = createMessage({
      from: fromAddr,
      to: options.to,
      subject: options.subject,
      content: options.html
        ? { html: options.html, text: options.text }
        : { text: options.text || '' }
    });

    try {
      const receipt = await this.getTransport().send(message);

      if (receipt.successful) {
        log.info('EMAIL', 'Sent', { to: options.to, subject: options.subject });
        return { success: true, messageId: receipt.messageId };
      }

      log.error('EMAIL', 'Failed', { error: receipt.errorMessages.join(', ') });
      return { success: false, error: receipt.errorMessages.join(', ') };
    } catch (err) {
      log.error('EMAIL', 'Error', { error: String(err) });
      return { success: false, error: String(err) };
    }
  }

  /**
   * Send OTP verification email
   */
  async sendOtp(
    to: string,
    otp: string,
    name?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #2563eb; margin-top: 0;">BuddyWallet Verification</h2>
    <p style="color: #374151;">Hi${name ? ` <strong>${name}</strong>` : ''},</p>
    <p style="color: #374151;">Your verification code is:</p>
    <div style="background: #eff6ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color: #9ca3af; font-size: 13px;">If you didn't request this, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">© ${new Date().getFullYear()} BuddyWallet</p>
  </div>
</body>
</html>`;

    return this.send({
      to,
      subject: `${otp} is your BuddyWallet verification code`,
      html,
      text: `Your BuddyWallet verification code is: ${otp}. This code expires in 10 minutes.`,
      from: 'noreply'
    });
  }

  /**
   * Close all SMTP connections
   */
  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.closeAllConnections();
      this.transport = null;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();
