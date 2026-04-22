/**
 * Session Mapper - Domain Transformations
 *
 * Handles transformation between Database Session entities and domain SessionInfo objects.
 */
import type { Session as SessionEntity } from '@repo/db';
import type { SessionInfo } from '@repo/types';

/**
 * Map database session entity to SessionInfo domain object
 * Strips sensitive token hashes and formats dates consistently
 */
export function toSessionInfo(session: SessionEntity): SessionInfo {
  return {
    id: session.id,
    userId: session.userId,
    accessToken: null, // Never expose tokens
    accessTokenHash: null, // Never expose hashes
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    refreshToken: '', // Never expose refresh token
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    status: session.status,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason,
    deviceName: session.deviceName,
    deviceType: session.deviceType,
    location: session.location,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    lastRefreshedAt: session.lastRefreshedAt,
    lastActiveAt: session.lastActiveAt,
    deletedAt: session.deletedAt,
    createdAt: session.createdAt
  };
}

/**
 * Map multiple sessions to SessionInfo domain objects
 */
export function toSessionInfoList(sessions: SessionEntity[]): SessionInfo[] {
  return sessions.map(toSessionInfo);
}

/**
 * Map session entity to public session info (for "active sessions" list)
 * Further reduces fields for public API exposure
 */
export function toPublicSessionInfo(
  session: SessionEntity,
  isCurrent: boolean = false
): Omit<SessionInfo, 'accessToken' | 'accessTokenHash' | 'refreshToken'> & { isCurrent: boolean } {
  return {
    id: session.id,
    userId: session.userId,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    status: session.status,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason,
    deviceName: session.deviceName,
    deviceType: session.deviceType,
    location: session.location,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    lastRefreshedAt: session.lastRefreshedAt,
    lastActiveAt: session.lastActiveAt,
    deletedAt: session.deletedAt,
    createdAt: session.createdAt,
    isCurrent
  };
}
