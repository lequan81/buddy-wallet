/**
 * Cryptographic utilities for secure token handling
 */
import { createHash } from 'node:crypto';
import { containsWeakPattern, SECRET_VALIDATION, type SecretValidationResult } from '@repo/config';

/**
 * Hash a token using SHA-256
 * Used for storing refresh tokens securely
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a token against its hash
 */
export async function verifyTokenHash(token: string, hash: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  // Constant-time comparison to prevent timing attacks
  if (tokenHash.length !== hash.length) return false;

  let result = 0;
  for (let i = 0; i < tokenHash.length; i++) {
    result |= tokenHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Validate JWT secret strength
 * Uses shared validation rules from @repo/config
 */
export function validateJWTSecret(secret: string): SecretValidationResult {
  const issues: string[] = [];

  if (secret.length < SECRET_VALIDATION.MIN_LENGTH) {
    issues.push(`JWT secret should be at least ${SECRET_VALIDATION.MIN_LENGTH} characters long`);
  }

  if (secret.length < SECRET_VALIDATION.RECOMMENDED_LENGTH) {
    issues.push(
      `Consider using a ${SECRET_VALIDATION.RECOMMENDED_LENGTH}+ character secret for enhanced security`
    );
  }

  // Check for common weak secrets using shared patterns
  if (containsWeakPattern(secret)) {
    issues.push('JWT secret contains common weak patterns');
  }

  // Check entropy (simple check for variety)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < SECRET_VALIDATION.MIN_UNIQUE_CHARS) {
    issues.push('JWT secret has low character variety');
  }

  const isValid =
    secret.length >= SECRET_VALIDATION.MIN_LENGTH &&
    uniqueChars >= SECRET_VALIDATION.MIN_UNIQUE_CHARS;

  const score: SecretValidationResult['score'] = !isValid
    ? 'weak'
    : secret.length >= SECRET_VALIDATION.RECOMMENDED_LENGTH
      ? 'strong'
      : 'acceptable';

  return { isValid, issues, score };
}

/**
 * Redact an identifier (email/phone) for safe logging.
 * Returns first 12 chars of SHA-256 hash.
 */
export function redactIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 12);
}
