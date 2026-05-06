import { describe, expect, test } from 'bun:test';
import { validateUserPassword } from '@/modules/auth/services/auth.service';
import { hashPassword, verifyPassword } from '@/commons/security/password';

describe('Auth Security Baseline', () => {
  test('validateUserPassword rejects weak passwords', () => {
    const result = validateUserPassword('weak');
    expect('code' in result).toBe(true);
  });

  test('validateUserPassword accepts strong passwords', () => {
    const result = validateUserPassword('StrongPass123!');
    expect('code' in result).toBe(false);
  });

  test('hashPassword/verifyPassword round-trip works', async () => {
    const password = 'StrongPass123!';
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('WrongPass123!', hash)).toBe(false);
  });
});
