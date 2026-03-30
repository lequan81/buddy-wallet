/**
 * Email Notification Types
 */
export interface EmailPayload {
  to: string;
  subject: string;
  template: 'otp' | 'welcome' | 'debt-reminder' | 'debt-confirmed' | 'payment-received';
  context: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}
