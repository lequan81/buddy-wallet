import type { DebtDetails } from './debt';
import type { SafeUser, UserResult } from './user';
import type { SessionInfo } from './session';
import type { CreateDebtInput, DebtResult, DebtStatus, StatusUpdateResult } from './debt';
import type { PaginatedResult, PaginationOptions, ExpiryOption } from './api';

// Auth Types
export interface RegisterInput {
  phoneNumber: string;
  password: string;
  name: string;
  email?: string;
}

export interface ClientHints {
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
  platform?: string;
}

export interface ClientLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export interface LoginInput {
  identifier: string;
  password?: string;
  otp?: string;
  userAgent?: string | null;
  clientIP?: string | null;
  clientHints?: ClientHints;
  coordinates?: { lat: number; lon: number } | null;
  clientLocation?: ClientLocation;
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
  user?: SafeUser;
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


export interface IDebtService {
  getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options?: PaginationOptions
  ): Promise<PaginatedResult<DebtDetails>>;
  getDebtsByUserId(userId: string, options?: PaginationOptions): Promise<PaginatedResult<DebtDetails>>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  getDebtById(debtId: string): Promise<DebtDetails | undefined>;
  createDebt(input: CreateDebtInput & { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }, currentUser: SafeUser): Promise<DebtResult>;
  updateDebtStatus(debtId: string, newStatus: DebtStatus, currentUser: SafeUser): Promise<StatusUpdateResult>;
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
