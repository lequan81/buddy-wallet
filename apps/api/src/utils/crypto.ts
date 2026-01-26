/**
 * Cryptographic utilities for secure token handling
 */

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
 */
export function validateJWTSecret(secret: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (secret.length < 32) {
    issues.push('JWT secret should be at least 32 characters long');
  }

  if (secret.length < 64) {
    issues.push('Consider using a 64+ character secret for enhanced security');
  }

  // Check for common weak secrets
  const weakSecrets = ['secret', 'password', 'jwt_secret', 'your-secret-key', 'changeme'];
  if (weakSecrets.some((weak) => secret.toLowerCase().includes(weak))) {
    issues.push('JWT secret contains common weak patterns');
  }

  // Check entropy (simple check for variety)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 10) {
    issues.push('JWT secret has low character variety');
  }

  return {
    valid: issues.length === 0 || (secret.length >= 32 && uniqueChars >= 10),
    issues
  };
}
