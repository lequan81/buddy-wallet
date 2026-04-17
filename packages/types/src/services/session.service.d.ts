import type { Result } from '../api/base';
import type { SafeUser } from '../core/user';
import type { SessionInfo } from '../infrastructure/sessions';
import type { JwtService } from './auth.service';

export interface RefreshSessionData {
  user: SafeUser;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Result type for session refresh
 */
export type RefreshSessionResult = Result<RefreshSessionData>;

export interface RequestInfo {
  userAgent: string | null;
  clientIP: string | null;
}

export interface SessionListData {
  sessions: SessionInfo[];
  currentSessionId: string | null;
}

export interface RevokeSessionData {
  isCurrent: boolean;
}

export interface ISessionService {
  refreshSession(
    refreshToken: string,
    jwt: JwtService,
    requestInfo: RequestInfo
  ): Promise<RefreshSessionResult>;
  getUserSessions(
    userId: string,
    currentRefreshToken?: string
  ): Promise<Result<SessionListData>>;
  revokeSession(
    sessionId: string,
    userId: string,
    currentRefreshToken?: string
  ): Promise<Result<RevokeSessionData>>;
  revokeAllSessions(userId: string): Promise<Result<{ count: number }>>;
}
