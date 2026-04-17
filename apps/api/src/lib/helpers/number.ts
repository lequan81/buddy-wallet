/**
 * Number helper functions
 */

/**
 * Format number as currency
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format number with commas as thousands separators
 */
export function formatNumber(num: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Round number to specified decimal places
 */
export function round(num: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Round up to specified decimal places
 */
export function roundUp(num: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(num * factor) / factor;
}

/**
 * Round down to specified decimal places
 */
export function roundDown(num: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor) / factor;
}

/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Check if number is within range (inclusive)
 */
export function inRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/**
 * Generate random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate sum of array
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, val) => acc + val, 0);
}

/**
 * Calculate average of array
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Find max value
 */
export function max(numbers: number[]): number {
  return Math.max(...numbers);
}

/**
 * Find min value
 */
export function min(numbers: number[]): number {
  return Math.min(...numbers);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse numeric value safely
 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
