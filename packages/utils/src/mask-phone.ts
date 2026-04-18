/**
 * Mask phone number for display
 * Shows first 3 and last 2 digits, hides the rest
 * Example: +84901234567 → +849****4567
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 5) {
    return '****';
  }

  const start = phone.substring(0, 3);
  const end = phone.substring(phone.length - 2);
  const masked = '*'.repeat(Math.max(0, phone.length - 5));

  return `${start}${masked}${end}`;
}
