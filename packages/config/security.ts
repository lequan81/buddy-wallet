/**
 * @repo/config - Security Validation Constants
 *
 * Centralized security validation rules for secrets and passwords.
 * Used by both frontend and backend for consistent validation.
 */

// ============================================
// WEAK SECRET PATTERNS
// ============================================

/**
 * Patterns that indicate a weak secret
 * Used for validating JWT secrets, API keys, etc.
 */
export const WEAK_SECRET_PATTERNS = [
  'secret',
  'password',
  'jwt_secret',
  'your-secret',
  'changeme',
  '123456',
  'admin',
  'test',
  'example',
  'default'
] as const;

export type WeakSecretPattern = (typeof WEAK_SECRET_PATTERNS)[number];

// ============================================
// SECRET VALIDATION RULES
// ============================================

/**
 * Minimum requirements for secure secrets
 */
export const SECRET_VALIDATION = {
  /** Minimum acceptable length */
  MIN_LENGTH: 32,
  /** Recommended length for production */
  RECOMMENDED_LENGTH: 64,
  /** Minimum unique characters for entropy */
  MIN_UNIQUE_CHARS: 10,
  /** Minimum entropy bits (informational) */
  MIN_ENTROPY_BITS: 128
} as const;

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Check if a secret contains weak patterns
 */
export function containsWeakPattern(secret: string): boolean {
  const lowerSecret = secret.toLowerCase();
  return WEAK_SECRET_PATTERNS.some((pattern) => lowerSecret.includes(pattern));
}

/**
 * Validation result type
 */
export interface SecretValidationResult {
  isValid: boolean;
  issues: string[];
  score: 'weak' | 'acceptable' | 'strong';
}

/**
 * Validate secret strength with detailed feedback
 */
export function validateSecretStrength(secret: string): SecretValidationResult {
  const issues: string[] = [];

  // Length check
  if (secret.length < SECRET_VALIDATION.MIN_LENGTH) {
    issues.push(`Secret must be at least ${SECRET_VALIDATION.MIN_LENGTH} characters`);
  } else if (secret.length < SECRET_VALIDATION.RECOMMENDED_LENGTH) {
    issues.push(
      `Consider using ${SECRET_VALIDATION.RECOMMENDED_LENGTH}+ characters for enhanced security`
    );
  }

  // Weak pattern check
  if (containsWeakPattern(secret)) {
    issues.push('Secret contains common weak patterns');
  }

  // Entropy check (character variety)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < SECRET_VALIDATION.MIN_UNIQUE_CHARS) {
    issues.push('Secret has low character variety');
  }

  // Determine score
  const hasMinLength = secret.length >= SECRET_VALIDATION.MIN_LENGTH;
  const hasMinEntropy = uniqueChars >= SECRET_VALIDATION.MIN_UNIQUE_CHARS;
  const hasNoWeakPatterns = !containsWeakPattern(secret);

  let score: SecretValidationResult['score'];
  if (hasMinLength && hasMinEntropy && hasNoWeakPatterns) {
    score = secret.length >= SECRET_VALIDATION.RECOMMENDED_LENGTH ? 'strong' : 'acceptable';
  } else if (hasMinLength && hasMinEntropy) {
    score = 'acceptable';
  } else {
    score = 'weak';
  }

  return {
    isValid: score !== 'weak',
    issues,
    score
  };
}
