/**
 * Email Configuration Types
 * Shared email service configuration interfaces
 */

/** Email sender aliases */
export type EmailFrom = 'noreply' | 'support';

/** Email message options */
export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: EmailFrom;
}

/** Email send operation result */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
