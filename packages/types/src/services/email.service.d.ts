export type EmailFrom = 'noreply' | 'support';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: EmailFrom;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
