/**
 * Password Validation Utilities
 *
 * SECURITY: Password complexity requirements to prevent weak passwords
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

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
const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'Password123!', '12345678', 'qwerty123',
  'abc123456', 'Password1!', 'Welcome1!', 'Admin123!', 'P@ssw0rd',
  'Password1', 'admin123', 'admin', '123456789', '123456', '1234567',
  '123123', '111111', 'password1234', 'qwerty', '1234567890', '12345',
  '123456789!', '12345678!', 'Password!', '!Password123', 'Admin123',
  'admin12345', 'pass123', 'pass1234', 'Qwer!234', 'Letme1n!'
]);

export function isCommonPassword(password: string): boolean {
  // Direct match
  if (COMMON_PASSWORDS.has(password)) return true;
  
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
