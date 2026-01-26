/**
 * Phone number utilities for normalization and validation
 */

/**
 * Normalize a phone number to a consistent format
 * - Removes all non-digit characters
 * - Handles Vietnamese phone number formats
 * - Returns null if invalid
 *
 * @example
 * normalizePhoneNumber('0912 345 678') // '0912345678'
 * normalizePhoneNumber('+84912345678') // '0912345678'
 * normalizePhoneNumber('84912345678')  // '0912345678'
 * normalizePhoneNumber('invalid')      // null
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let normalized = phone.trim();

  // Remove all spaces, dashes, dots, parentheses
  normalized = normalized.replace(/[\s\-\.\(\)]/g, '');

  // Handle Vietnamese country code variations
  if (normalized.startsWith('+84')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('84') && normalized.length === 11) {
    // 84xxxxxxxxx format (11 digits with country code)
    normalized = '0' + normalized.slice(2);
  }

  // Remove leading + if still present
  normalized = normalized.replace(/^\+/, '');

  // Validate: should be all digits now
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  // Validate length (Vietnamese phones are typically 10 digits)
  if (normalized.length < 9 || normalized.length > 15) {
    return null;
  }

  return normalized;
}

/**
 * Validate phone number format
 * Returns true if the phone number is valid
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  return normalizePhoneNumber(phone) !== null;
}

/**
 * Format phone number for display
 * @example
 * formatPhoneDisplay('0912345678') // '0912 345 678'
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;

  // Vietnamese format: 0xxx xxx xxx
  if (normalized.length === 10 && normalized.startsWith('0')) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
  }

  // Default: group by 3s from the end
  return normalized.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/**
 * Mask phone number for privacy
 * @example
 * maskPhone('0912345678') // '0912***678'
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length < 7) return '***';

  const visibleStart = 4;
  const visibleEnd = 3;
  const masked = '*'.repeat(normalized.length - visibleStart - visibleEnd);

  return normalized.slice(0, visibleStart) + masked + normalized.slice(-visibleEnd);
}
