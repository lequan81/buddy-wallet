/**
 * Password Validation Utilities
 *
 * SECURITY: Password complexity requirements to prevent weak passwords
 */
import { SHARED_CONSTANTS } from '@repo/config';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Common passwords set - imported from shared config
 */
const COMMON_PASSWORDS = new Set(SHARED_CONSTANTS.SECURITY.COMMON_PASSWORDS);

/**
 * Validate password complexity
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordComplexity(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Maximum length (prevent DoS)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // At least one number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // At least one special character
  // eslint-disable-next-line no-useless-escape
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if password is in common password list or has low entropy
 */

export function isCommonPassword(password: string): boolean {
  // Direct match - cast to expected literal type
  if (COMMON_PASSWORDS.has(password as typeof SHARED_CONSTANTS.SECURITY.COMMON_PASSWORDS[number])) return true;
  
  const lower = password.toLowerCase();
  
  // Basic variations of 'password'
  if (lower.startsWith('password') || lower.startsWith('p@ssword')) return true;

  // Check for repeated sequences (e.g., '123123123', 'abcabcabc')
  if (/(.+?)\1{2,}/.test(lower)) return true;

  // Check for simple keyboard runs
  if (/(qwerty|asdfgh|zxcvbn|123456)/.test(lower)) return true;

  // Check for consecutive identical characters (e.g., 'aaaaaa1!')
  if (/(.)\1{4,}/.test(lower)) return true;

  return false;
}

/**
 * Re-export toSafeUser from mappers for backward compatibility
 * @deprecated Use @/lib/mappers instead
 */
export { toSafeUser } from '../mappers/user';

/**
 * Redact identifier (email/phone) for logging
 */
export function redactIdentifier(identifier: string): string {
  if (!identifier) return '';
  if (identifier.includes('@')) {
    const [user, domain] = identifier.split('@');
    return `${user[0]}***@${domain}`;
  }
  return `${identifier.slice(0, 3)}***${identifier.slice(-3)}`;
}

/**
 * Hash a token (e.g., refresh token, email token) for database storage
 */
export async function hashToken(token: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(token);
  return hasher.digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

/**
 * Very basic user agent parser for session display
 */
export function parseUserAgent(ua: string | null, _clientHints?: unknown): { deviceName: string, deviceType: string } {
  if (!ua) return { deviceName: 'Unknown', deviceType: 'unknown' };
  
  let deviceName = 'Generic Device';
  let deviceType = 'desktop';

  const userAgent = ua.toLowerCase();
  if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
    deviceType = 'mobile';
    if (/iphone|ipad/i.test(userAgent)) deviceName = 'Apple Device';
    else if (/android/i.test(userAgent)) deviceName = 'Android Device';
  } else if (/tablet/i.test(userAgent)) {
    deviceType = 'tablet';
  }

  return { deviceName, deviceType };
}

/**
 * Get location string from IP
 */
export async function getLocationFromIP(
  ip: string | null,
  clientLocation?: string | null,
  coordinates?: { latitude?: number; longitude?: number }
): Promise<string | null> {
  if (clientLocation) return clientLocation;
  // Fallback to coordinates if provided
  if (coordinates?.latitude && coordinates?.longitude) {
    return `${coordinates.latitude.toFixed(2)}, ${coordinates.longitude.toFixed(2)}`;
  }
  return ip ? 'Remote Location' : null;
}

