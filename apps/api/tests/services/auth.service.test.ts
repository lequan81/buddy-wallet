import { describe, expect, it } from 'bun:test';
import {
  validateUserPassword,
  generateOtp,
  generateRefreshToken,
  getTokenLifetimes,
  buildResetUrl
} from '@/modules/auth/services/auth.service';

describe('Auth Service Functions', () => {
  it('validates strong passwords', () => {
    const result = validateUserPassword('ValidPass123!');
    expect('code' in result).toBe(false);
  });

  it('generates six-digit OTP', () => {
    const otp = generateOtp();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it('generates random refresh token', () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('returns token lifetimes from config', () => {
    const lifetimes = getTokenLifetimes();
    expect(lifetimes.accessMs).toBeGreaterThan(0);
    expect(lifetimes.refreshMs).toBeGreaterThan(0);
  });

  it('builds reset URL containing token', () => {
    const url = buildResetUrl('abc123');
    expect(url.includes('abc123')).toBe(true);
  });
});
