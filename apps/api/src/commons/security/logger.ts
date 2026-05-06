/**
 * Security Event Logging
 *
 * Logs suspicious security events for audit and detection purposes.
 */

import { logger } from '@repo/logger';

/**
 * Log JWT tampering attempt
 */
export function logJWTTampered(userId: string, details: Record<string, unknown>): void {
  logger.warn('JWT tampering detected', {
    userId,
    ...details
  });
}

/**
 * Log potential session hijacking attempt
 */
export function logSessionHijack(userId: string, details: Record<string, unknown>): void {
  logger.warn('Session hijack attempt detected', {
    userId,
    ...details
  });
}

/**
 * Log general security event
 */
export function logSecurityEvent(
  eventType: string,
  userId: string | null,
  details: Record<string, unknown>
): void {
  logger.warn(`Security event: ${eventType}`, {
    userId: userId ?? undefined,
    ...details
  });
}

