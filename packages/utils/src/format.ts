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
 * Format amount as currency with configurable currency code.
 * Default: Vietnamese Dong (VND).
 */
export function formatCurrency(amount: number, currency = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date string or Date object to localized display string.
 * - 'short': "Mar 4, 2026"
 * - 'long':  "Mar 4, 2026, 02:30 PM"
 * - 'datetime': full locale string
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: 'short' | 'long' | 'datetime' = 'short'
): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  switch (style) {
    case 'short':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    case 'long':
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'datetime':
      return d.toLocaleString();
  }
}
