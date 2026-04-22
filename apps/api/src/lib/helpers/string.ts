/**
 * String helper functions
 */

/**
 * Convert string to URL-friendly slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_[a-z]/g, match => match.charAt(1).toUpperCase());
}

/**
 * Convert to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/(?:^|[_\s-]+)([a-zA-Z])/g, (_, char) => char.toUpperCase())
    .replace(/[_\s-]+/g, '');
}

/**
 * Remove special characters from string
 */
export function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9\s]/g, '');
}

/**
 * Normalize whitespace (replace multiple spaces with single)
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Mask string with asterisks (for sensitive data like phone numbers)
 * Example: mask("1234567890", 2, 2) -> "12******90"
 */
export function mask(str: string, visibleStart = 2, visibleEnd = 2): string {
  if (str.length <= visibleStart + visibleEnd) return str;
  const start = str.slice(0, visibleStart);
  const end = str.slice(-visibleEnd);
  const middle = '*'.repeat(str.length - visibleStart - visibleEnd);
  return start + middle + end;
}

/**
 * Check if string is valid email
 */
export function isValidEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * Extract numbers from string
 */
export function extractNumbers(str: string): string {
  return str.replace(/\D/g, '');
}

/**
 * Pad number with leading zeros
 */
export function padZero(num: number, length: number): string {
  return num.toString().padStart(length, '0');
}

