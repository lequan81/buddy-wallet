import type { Debt } from '@repo/db';
import type { SafeUser, UserResult } from './user';
import type { SessionInfo } from './session';
import type { DebtResult, DebtStatus } from './debt';

// Auth Types
export interface RegisterInput {
  phoneNumber: string;
  password: string;
  name: string;
  email?: string;
}

export interface LoginInput {
  identifier: string;
  password?: string;
  otp?: string;
  userAgent?: string | null;
  clientIP?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientHints?: any;
  coordinates?: { lat: number; lon: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientLocation?: any;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  expiresIn?: number;
  user?: SafeUser;
  error?: string;
  code?: string;
  isNewUser?: boolean;
  mustChangePassword?: boolean;
}

export interface JwtService {
  sign(payload: object): Promise<string>;
  verify(token: string): Promise<object | false>;
}

// Session Types
export interface RefreshSessionResult {
  success: boolean;
  error?: string;
  user?: { id: string; email: string | null; role: string };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

// Request Info
export interface RequestInfo {
  userAgent: string | null;
  clientIP: string | null;
}

// Interfaces
export interface IAuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput, jwt: JwtService): Promise<AuthResult & { sessionId?: string }>;
  logout(refreshToken: string, userId?: string): Promise<{ success: boolean; error?: string }>;
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<{ success: boolean; error?: string }>;
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
  ): Promise<{ success: boolean; error?: string; isCurrent?: boolean }>;
  revokeAllSessions(userId: string): Promise<{ success: boolean; count: number }>;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IDebtService {
  getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Debt>>;
  getDebtsByUserId(userId: string, options?: PaginationOptions): Promise<PaginatedResult<Debt>>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  getDebtById(debtId: string): Promise<Debt | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createDebt(input: any, currentUser: any): Promise<DebtResult>; // Typed as any to avoid circular deps for now, or need to verify input types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDebtStatus(debtId: string, newStatus: DebtStatus, currentUser: any): Promise<any>;
}

export interface IUserService {
  getAllUsers(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ users: SafeUser[]; total: number; hasMore: boolean }>;
  getUserById(userId: string): Promise<UserResult>;
  toggleUserStatus(userId: string): Promise<UserResult>;
  updateUserPermissions?(userId: string, permissions: string[]): Promise<UserResult>;
}
