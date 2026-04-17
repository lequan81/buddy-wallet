/**
 * Date helper functions
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Format date to ISO string (UTC)
 */
export function formatISO(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO string to Date
 */
export function parseISO(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Format date to local string
 */
export function formatDate(date: Date, locale = 'en-US'): string {
  return date.toLocaleDateString(locale);
}

/**
 * Format datetime to local string
 */
export function formatDateTime(date: Date, locale = 'en-US'): string {
  return date.toLocaleString(locale);
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Add hours to date
 */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR);
}

/**
 * Add minutes to date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Get difference in days between two dates
 */
export function differenceInDays(date1: Date, date2: Date): number {
  const diff = date1.getTime() - date2.getTime();
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Get difference in hours between two dates
 */
export function differenceInHours(date1: Date, date2: Date): number {
  const diff = date1.getTime() - date2.getTime();
  return Math.floor(diff / MS_PER_HOUR);
}

/**
 * Truncate date to remove milliseconds
 */
export function truncateToSeconds(date: Date): Date {
  return new Date(Math.floor(date.getTime() / MS_PER_SECOND) * MS_PER_SECOND);
}
