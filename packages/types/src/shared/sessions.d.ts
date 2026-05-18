/**
 * Session & Device Types
 */
export type SessionStatus = 'active' | 'revoked' | 'expired' | 'logged_out';

export type RevokedReason =
  | 'user_revoked'
  | 'user_logout'
  | 'logout_all_devices'
  | 'password_change'
  | 'admin_revoke'
  | 'suspicious_activity'
  | 'session_expired';

export interface ClientHints {
  platform?: string;
  mobile?: boolean;
}

export interface Coordinates {
  lat: number;
  lon: number;
  latitude: number;
  longitude: number;
}

export interface ClientLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  coordinates?: Coordinates | null;
  timezone?: string | null;
}

export interface SessionInfo {
  id: string;
  userId: string;
  accessToken: string | null;
  accessTokenHash: string | null;
  accessTokenExpiresAt: Date | string;
  refreshToken: string;
  refreshTokenExpiresAt: Date | string;
  status: SessionStatus;
  revokedAt: Date | string | null;
  revokedReason: RevokedReason | null;
  deviceName: string | null;
  deviceType: string | null;
  location: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastRefreshedAt: Date | string | null;
  lastActiveAt: Date | string | null;
  deletedAt: Date | string | null;
  createdAt: Date | string;
  isCurrent?: boolean;
}
