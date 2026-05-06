import { describe, expect, test } from 'bun:test';
import { renderTemplate } from '@/modules/auth/services/email.service';

describe('Email Template Rendering', () => {
  test('renders OTP template with placeholder values', async () => {
    const html = await renderTemplate('otp-email', { NAME: 'Test', OTP_CODE: '123456' });

    expect(html.includes('Test')).toBe(true);
    expect(html.includes('123456')).toBe(true);
  });

  test('renders password reset template with URL', async () => {
    const html = await renderTemplate('password-reset', {
      NAME: 'Test User',
      RESET_LINK: 'https://example.com/reset?token=abc'
    });

    expect(html.includes('Test User')).toBe(true);
    expect(html.includes('https://example.com/reset?token=abc')).toBe(true);
  });

  test('sanitizes CRLF values in template fields', async () => {
    const html = await renderTemplate('otp-email', {
      NAME: 'User\r\nBCC:evil@example.com',
      OTP_CODE: '123456'
    });

    expect(html.includes('User\r\nBCC:evil@example.com')).toBe(false);
    expect(html.includes('User\nBCC:evil@example.com')).toBe(false);
    expect(html.includes('UserBCC:evil@example.com')).toBe(true);
    expect(html.includes('BCC:evil@example.com')).toBe(true);
  });
});
