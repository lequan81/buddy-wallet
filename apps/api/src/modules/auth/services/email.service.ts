/**
 * Email Service
 *
 * SMTP email delivery using @upyo/smtp with singleton transport.
 * @logicType infrastructure
 */

import { logger } from '@repo/logger';
import { file } from 'bun';
import { createMessage } from '@upyo/core';
import { SmtpTransport } from '@upyo/smtp';

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

// ── Singleton Transport ─────────────────────────────────

let transport: SmtpTransport | null = null;
const HEADER_CONTROL_CHARS_REGEX = /[\r\n\x00-\x1F\x7F]/g;

function getTransport(): SmtpTransport {
  if (!transport) {
    transport = new SmtpTransport({
      host: Bun.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(Bun.env.SMTP_PORT || '587', 10),
      secure: Bun.env.SMTP_SECURE === 'true',
      auth: {
        user: Bun.env.SMTP_USER || '',
        pass: Bun.env.SMTP_PASS || '',
      },
    });
  }
  return transport;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(HEADER_CONTROL_CHARS_REGEX, '').trim();
}

function sanitizeTemplateValue(value: string): string {
  return value.replace(HEADER_CONTROL_CHARS_REGEX, '').trim();
}

// ── Template Rendering ──────────────────────────────────

/**
 * Render email template from static HTML file.
 * Replaces {{KEY}} placeholders with provided data.
 */
export async function renderTemplate(templateName: string, data: Record<string, string>): Promise<string> {
  try {
    const templatePath = `${import.meta.dir}/../../../static/emails/${templateName}.html`;
    const templateFile = file(templatePath);
    const template = await templateFile.text();

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (typeof value !== 'string') {
        return match;
      }
      return sanitizeTemplateValue(value);
    });
  } catch (error) {
    logger.error('Failed to render email template', {
      templateName,
      error: String(error)
    });
    throw new Error(`Failed to render template: ${templateName}`);
  }
}

// ── Send ────────────────────────────────────────────────

/**
 * Send email via the singleton SMTP transport
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  try {
    const safeTo = sanitizeHeaderValue(message.to);
    const safeSubject = sanitizeHeaderValue(message.subject);
    const safeReplyTo = message.replyTo ? sanitizeHeaderValue(message.replyTo) : undefined;

    logger.debug('Sending email', {
      to: safeTo,
      subject: safeSubject
    });

    const email = createMessage({
      from: sanitizeHeaderValue(Bun.env.SMTP_FROM_NOREPLY || Bun.env.SMTP_USER || 'noreply@example.com'),
      to: safeTo,
      subject: safeSubject,
      ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
      content: { text: message.text || '', html: message.html },
    });

    const receipt = await getTransport().send(email);

    if (receipt.successful) {
      logger.info('Email sent successfully', {
        messageId: receipt.messageId,
        to: safeTo
      });
      return { success: true, messageId: receipt.messageId };
    } else {
      throw new Error(`Send failed: ${receipt.errorMessages.join(', ')}`);
    }
  } catch (error) {
    logger.error('Email send failed', {
      to: sanitizeHeaderValue(message.to),
      error: String(error)
    });

    return { success: false, error: String(error) };
  }
}

// ── Convenience Senders ─────────────────────────────────

/**
 * Send OTP verification email
 */
export async function sendOtp(email: string, otp: string, name: string): Promise<SendResult> {
  const html = await renderTemplate('otp-email', {
    NAME: name,
    OTP_CODE: otp
  });

  return sendEmail({
    to: email,
    subject: 'Verify Your Email - OTP Code',
    html,
    text: `Your OTP code is: ${otp}`
  });
}

/** Alias for sendOtp */
export const sendVerificationEmail = sendOtp;

/**
 * Send password reset email with a clickable URL
 */
export async function sendPasswordReset(email: string, resetUrl: string, name: string): Promise<SendResult> {
  const html = await renderTemplate('password-reset', {
    NAME: name,
    RESET_LINK: resetUrl
  });

  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html,
    text: `Click here to reset your password: ${resetUrl}`
  });
}

/**
 * Send notification email
 */
export async function sendNotification(email: string, subject: string, content: string): Promise<SendResult> {
  return sendEmail({
    to: email,
    subject,
    html: `<p>${content}</p>`,
    text: content
  });
}
