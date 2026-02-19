/**
 * Format currency to VND
 */
export const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Normalize a phone number to a consistent format
 * - Removes all non-digit characters
 * - Handles Vietnamese phone number formats
 * - Returns null if invalid
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let normalized = phone.trim();
  normalized = normalized.replace(/[\s\-.()]/g, '');

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
 * Format phone number for display
 * e.g., 0912345678 -> 0912 345 678
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;

  // Vietnamese format: 0xxx xxx xxx
  if (normalized.length === 10 && normalized.startsWith('0')) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
  }

  // Fallback for other lengths
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

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Format log message for consistent output
 */
export function formatLog(
  level: LogLevel,
  category: string,
  message: string,
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${contextStr}`;
}
