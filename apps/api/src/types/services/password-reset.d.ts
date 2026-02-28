/**
 * Password Reset Service Types
 */

/**
 * Result of a password reset operation
 */
export interface ResetResult {
  success: boolean;
  error?: string;
}
