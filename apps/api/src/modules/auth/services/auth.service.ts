/**
 * Auth service pure helpers.
 * @logicType backend
 */

import { randomUUIDv7 } from 'bun';
import { authConfig } from '@/config';
import { env } from '@repo/config';
import { validatePasswordComplexity, isCommonPassword } from '@/commons/security/password';
import { BE_ERRORS } from '@repo/errors';
import type { Result } from '@repo/types';
import type { JWTPayload } from '../plugins/jwt.plugin';

const { OTP } = authConfig;

export function generateOtp(): string {
  return (100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)).toString();
}

export function generateResetToken(): string {
  return randomUUIDv7('hex');
}

export function generateRefreshToken(): string {
  return randomUUIDv7('hex');
}

export function getTokenLifetimes(): { accessMs: number; refreshMs: number } {
  return {
    accessMs: authConfig.ACCESS_TOKEN_LIFETIME,
    refreshMs: authConfig.REFRESH_TOKEN_LIFETIME
  };
}

export async function signAccessToken(
  jwt: { sign: (payload: JWTPayload) => Promise<string | false> } | undefined,
  user: { id: string; phoneNumber: string; sessionVersion?: number }
): Promise<string | null> {
  if (!jwt) return null;

  const signed = await jwt.sign({
    id: user.id,
    phoneNumber: user.phoneNumber,
    sessionVersion: user.sessionVersion || 1
  });

  if (!signed || typeof signed !== 'string') {
    return null;
  }

  return signed;
}

export function validateUserPassword(password: string): Result<void> {
  const validation = validatePasswordComplexity(password);
  if (!validation.isValid) {
    return {
      code: BE_ERRORS.AUTH_WEAK_PASSWORD.code,
      error: validation.errors.join('. ')
    };
  }

  if (isCommonPassword(password)) {
    return {
      code: BE_ERRORS.AUTH_COMMON_PASSWORD.code,
      error: BE_ERRORS.AUTH_COMMON_PASSWORD.message
    };
  }

  return { data: undefined };
}

const DEVICE_PATTERNS: { regex: RegExp; type: string; name: string }[] = [
  { regex: /ipad/i, type: 'tablet', name: 'iPad' },
  { regex: /iphone/i, type: 'mobile', name: 'iPhone' },
  { regex: /android/i, type: 'mobile', name: 'Android Device' },
  { regex: /tablet/i, type: 'tablet', name: 'Generic Tablet' },
  { regex: /mobile|phone/i, type: 'mobile', name: 'Mobile Device' }
];

export function parseDeviceInfo(userAgent: string): { deviceName: string; deviceType: string } {
  if (!userAgent) return { deviceName: 'Unknown', deviceType: 'unknown' };

  const ua = userAgent.toLowerCase();

  for (const pattern of DEVICE_PATTERNS) {
    if (pattern.regex.test(ua)) {
      return { deviceName: pattern.name, deviceType: pattern.type };
    }
  }

  return { deviceName: 'Desktop', deviceType: 'desktop' };
}

export async function getLocation(ipAddress: string): Promise<string | null> {
  if (!ipAddress || ipAddress === '127.0.0.1') return null;
  return 'Remote Location';
}

export function calculateOtpExpiry(): Date {
  return new Date(Date.now() + OTP.EXPIRY_MINUTES * 60 * 1000);
}

export function calculateResetTokenExpiry(): Date {
  const expiryHours = 1;
  return new Date(Date.now() + expiryHours * 60 * 60 * 1000);
}

export function buildResetUrl(token: string): string {
  const baseUrl = env.string('FRONTEND_URL', 'http://localhost:5173');
  return `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
}
