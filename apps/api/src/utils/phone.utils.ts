/**
 * Phone number utilities
 * Re-exported from @repo/utils
 */
export { normalizePhoneNumber, formatPhoneDisplay, maskPhone } from '@repo/utils';

/**
 * Validate phone number format
 * Returns true if the phone number is valid
 */
import { normalizePhoneNumber } from '@repo/utils';

export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  return normalizePhoneNumber(phone) !== null;
}
