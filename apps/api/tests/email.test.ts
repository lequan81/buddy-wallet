/**
 * Email Service Integration Test
 *
 * Run: bun test tests/email.test.ts
 *
 * Note: This test sends real emails. Set TEST_EMAIL env var to your test email.
 * Requires SMTP credentials in .env file.
 */
import { describe, expect, it, afterAll } from 'bun:test';
import { EmailService as EmailServiceClass } from '@services/EmailService';
const EmailService = new EmailServiceClass({
  host: Bun.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(Bun.env.SMTP_PORT || 587),
  user: Bun.env.SMTP_USER || '',
  password: Bun.env.SMTP_PASSWORD || Bun.env.SMTP_PASS || '',
  fromNoReply: Bun.env.SMTP_FROM_NOREPLY || 'no-reply@buddywallet.dpdns.org',
  fromSupport: Bun.env.SMTP_FROM_SUPPORT || 'support@buddywallet.dpdns.org',
  poolSize: Number(Bun.env.SMTP_POOL_SIZE || 5)
});

const testEmail = Bun.env.TEST_EMAIL;

describe('EmailService (Integration)', () => {
  afterAll(async () => {
    await EmailService.close();
  });

  describe('when SMTP is configured', () => {
    it.skipIf(!Bun.env.SMTP_USER)('should send OTP email successfully', async () => {
      if (!testEmail) {
        console.log('⏭️ Skipping: TEST_EMAIL not set');
        return;
      }

      console.log('📧 Sending test OTP email to:', testEmail);

      const result = await EmailService.sendOtp(testEmail, '123456', 'Test User');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      console.log('Email sent, Message ID:', result.messageId);
    });

    it.skipIf(!Bun.env.SMTP_USER)('should send generic email successfully', async () => {
      if (!testEmail) {
        console.log('⏭️ Skipping: TEST_EMAIL not set');
        return;
      }

      const result = await EmailService.send({
        to: testEmail,
        subject: 'BuddyWallet Test Email',
        text: 'This is a test email from BuddyWallet API tests.',
        html: '<h1>Test Email</h1><p>This is a test email from BuddyWallet API tests.</p>'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('when SMTP is not configured', () => {
    it.skipIf(!!Bun.env.SMTP_USER)('should fail gracefully without SMTP credentials', async () => {
      const result = await EmailService.send({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      });

      // Should fail but not throw
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
