/**
 * Security Event Logger
 *
 * Centralized logging for security events to enable:
 * - Attack detection and monitoring
 * - Security incident response
 * - Compliance and audit trails
 * - Pattern analysis for threat intelligence
 */
import { logger } from '@utils/logger';

/**
 * Security event types
 */
export type SecurityEventType =
  | 'jwt_tampered' // JWT signature validation failed
  | 'jwt_expired' // Expired token used
  | 'token_replay' // Blacklisted token reused
  | 'session_hijack' // sessionVersion mismatch
  | 'permission_escalation' // Attempt to access unauthorized resource
  | 'suspicious_refresh' // Multiple failed refresh attempts
  | 'account_lockout' // Too many failed login attempts
  | 'credential_stuffing' // Login from multiple IPs rapidly
  | 'brute_force' // Multiple password attempts
  | 'csrf_violation' // CSRF token validation failed
  | 'rate_limit_exceeded' // Rate limit threshold exceeded
  | 'invalid_origin' // Request from unauthorized origin
  | 'sql_injection_attempt' // SQL injection pattern detected
  | 'xss_attempt' // XSS pattern detected
  | 'unauthorized_access'; // Access attempt to forbidden resource

/**
 * Security event context
 */
export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  method?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Severity levels for security events
 */
const SEVERITY: Record<SecurityEventType, 'critical' | 'high' | 'medium' | 'low'> = {
  jwt_tampered: 'critical',
  session_hijack: 'critical',
  permission_escalation: 'critical',
  sql_injection_attempt: 'critical',
  credential_stuffing: 'high',
  brute_force: 'high',
  account_lockout: 'high',
  token_replay: 'high',
  suspicious_refresh: 'medium',
  jwt_expired: 'medium',
  csrf_violation: 'medium',
  rate_limit_exceeded: 'medium',
  invalid_origin: 'medium',
  xss_attempt: 'medium',
  unauthorized_access: 'low'
};

/**
 * Log a security event
 *
 * @param event Security event details
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const severity = SEVERITY[event.type];
  const timestamp = event.timestamp || new Date();

  const logData = {
    severity,
    type: event.type,
    userId: event.userId,
    sessionId: event.sessionId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    resource: event.resource,
    method: event.method,
    timestamp: timestamp.toISOString(),
    ...event.details
  };

  // Log to application logger with appropriate level
  if (severity === 'critical' || severity === 'high') {
    logger.error(`[SECURITY] ${event.type}`, logData);
  } else if (severity === 'medium') {
    logger.warn(`[SECURITY] ${event.type}`, logData);
  } else {
    logger.info(`[SECURITY] ${event.type}`, logData);
  }

  // TODO: In production, send to security monitoring service
  // TODO: In production, send to security monitoring service
  /*
  if (config.APP.IS_PROD) {
    await sendToSentryOrDatadog(event);
    await sendToSecurityTeamSlack(event);
  }
  */
}

/**
 * Log JWT tampering attempt
 */
export function logJWTTampered(ipAddress?: string, userAgent?: string): void {
  logSecurityEvent({
    type: 'jwt_tampered',
    ipAddress,
    userAgent,
    details: { message: 'JWT signature validation failed - possible tampering attempt' }
  });
}

/**
 * Log token replay attempt
 */
export function logTokenReplay(userId: string, ipAddress?: string): void {
  logSecurityEvent({
    type: 'token_replay',
    userId,
    ipAddress,
    details: { message: 'Blacklisted token reused - possible theft or replay attack' }
  });
}

/**
 * Log session hijacking attempt
 */
export function logSessionHijack(userId: string, jwtVersion: number, currentVersion: number): void {
  logSecurityEvent({
    type: 'session_hijack',
    userId,
    details: {
      jwtVersion,
      currentVersion,
      message: 'sessionVersion mismatch - old token after password change'
    }
  });
}

/**
 * Log permission escalation attempt
 */
export function logPermissionEscalation(
  userId: string,
  resource: string,
  requiredPermission: string,
  userPermissions: string[]
): void {
  logSecurityEvent({
    type: 'permission_escalation',
    userId,
    resource,
    details: {
      requiredPermission,
      userPermissions,
      message: 'Unauthorized access attempt to protected resource'
    }
  });
}

/**
 * Log suspicious refresh token activity
 */
export function logSuspiciousRefresh(attemptCount: number, ipAddress?: string): void {
  logSecurityEvent({
    type: 'suspicious_refresh',
    ipAddress,
    details: {
      attemptCount,
      message: 'Multiple failed refresh attempts detected'
    }
  });
}

/**
 * Log brute force attack
 */
export function logBruteForce(identifier: string, attemptCount: number, ipAddress?: string): void {
  logSecurityEvent({
    type: 'brute_force',
    ipAddress,
    details: {
      identifier,
      attemptCount,
      message: 'Multiple failed login attempts - possible brute force attack'
    }
  });
}

/**
 * Log account lockout
 */
export function logAccountLockout(userId: string, reason: string): void {
  logSecurityEvent({
    type: 'account_lockout',
    userId,
    details: {
      reason,
      message: 'Account locked due to suspicious activity'
    }
  });
}
