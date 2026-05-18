/**
 * Mailer Provider
 * 
 * Exports mailer instance for email operations.
 * In ElysiaJS FP, we export the instance directly without DI container.
 */

// TODO: Implement mailer provider based on your email service
// This is a placeholder - implement based on your actual email service (Resend, SendGrid, etc.)

import { log } from '@repo/logger';

export const mailer = {
  send: async (options: { to: string; subject: string; html: string }) => {
    log.info('MAILER', 'Sending email', { to: options.to });
  }
};
