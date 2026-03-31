/**
 * Security & Validation Configuration
 */

export const SECRET_VALIDATION = {
  MIN_LENGTH: 32,
  RECOMMENDED_LENGTH: 64,
  MIN_UNIQUE_CHARS: 10,
} as const;

export type SecretValidationResult = {
  isValid: boolean;
  score: 'weak' | 'acceptable' | 'strong';
  issues: string[];
};

/**
 * Check if a string contains common weak patterns (e.g. 12345, qwerty)
 */
export function containsWeakPattern(text: string): boolean {
  const weakPatterns = [
    '12345',
    '88888',
    'password',
    'qwerty',
    'admin',
    'welcome',
    'secret',
  ];
  const lowerText = text.toLowerCase();
  return weakPatterns.some((pattern) => lowerText.includes(pattern));
}
