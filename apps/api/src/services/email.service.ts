/**
 * Email Service (@upyo/smtp)
 *
 * Sends transactional emails via Gmail SMTP with connection pooling.
 * Supports two sender aliases: noreply and support.
 */
import { SmtpTransport } from '@upyo/smtp';
import { createMessage } from '@upyo/core';
import { log } from '../utils/logger';
import { renderOtp, renderWelcome } from '@repo/email-templates';

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
    const html = await renderOtp({
      otp,
      name
    });

    return this.send({
      to,
      subject: `${otp} is your BuddyWallet verification code`,
      html,
      text: `Your BuddyWallet verification code is: ${otp}. This code expires in 10 minutes.`,
      from: 'noreply'
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcome(
    to: string,
    name: string,
    loginUrl?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = await renderWelcome({
      name,
      loginUrl
    });

    return this.send({
      to,
      subject: 'Welcome to BuddyWallet!',
      html,
      text: `Welcome to BuddyWallet, ${name}! Your account is ready. Visit ${loginUrl || 'https://buddywallet.app/login'} to get started.`,
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
