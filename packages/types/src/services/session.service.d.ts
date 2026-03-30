import type { BaseResult } from '../api/base';
import type { SafeUser } from '../core/user';
import type { SessionInfo } from '../infrastructure/sessions';
import type { JwtService } from './auth.service';

export interface RefreshSessionResult extends BaseResult {
  user?: SafeUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface RequestInfo {
  userAgent: string | null;
  clientIP: string | null;
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
  ): Promise<{ sessions: SessionInfo[]; currentSessionId: string | null }>;
  revokeSession(
    sessionId: string,
    userId: string,
    currentRefreshToken?: string
  ): Promise<BaseResult & { isCurrent?: boolean }>;
  revokeAllSessions(userId: string): Promise<BaseResult & { count: number }>;
}
