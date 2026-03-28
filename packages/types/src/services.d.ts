import type { BaseResult, BaseResult as ResetResult } from './base.js';
import type { SafeUser, UserResult } from './user.js';
import type { DebtStatus, DebtDirection, DebtDetails, DebtResult, StatusUpdateResult, CreateDebtInput } from './debt.js';
import type { PaginationOptions, PaginatedResult, ExpiryOption } from './api.js';
import type { DeviceInfo, ClientHints, Coordinates, ClientLocation } from './device.js';
import type { SessionInfo } from './session.js';

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
  clientHints?: ClientHints;
  coordinates?: Coordinates | null;
  clientLocation?: ClientLocation;
}

export interface AuthResult extends BaseResult {
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  expiresIn?: number;
  user?: SafeUser;
  isNewUser?: boolean;
  mustChangePassword?: boolean;
}

export interface JwtService {
  sign(payload: object): Promise<string>;
  verify(token: string): Promise<object | false>;
}

// Session Types
export interface RefreshSessionResult extends BaseResult {
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
  logout(refreshToken: string, userId?: string): Promise<BaseResult>;
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<BaseResult>;
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


export interface IDebtService {
  getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options?: ApiPaginationOptions
  ): Promise<PaginatedResult<DebtDetails>>;
  getDebtsByUserId(userId: string, options?: ApiPaginationOptions): Promise<PaginatedResult<DebtDetails>>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  getDebtById(debtId: string): Promise<DebtDetails | undefined>;
  createDebt(input: CreateDebtInput & { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }, currentUser: SafeUser): Promise<DebtResult>;
  updateDebtStatus(debtId: string, newStatus: DebtStatus, currentUser: SafeUser): Promise<StatusUpdateResult>;
}

export interface IUserService {
  getAllUsers(options?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<SafeUser>>;
  getUserById(userId: string): Promise<UserResult>;
  toggleUserStatus(userId: string): Promise<UserResult>;
  updateUserPermissions?(userId: string, permissions: string[]): Promise<UserResult>;
  updateProfile(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      emailNotificationsEnabled?: boolean;
      pushNotificationsEnabled?: boolean;
    }
  ): Promise<UserResult>;
  canReceivePush(userId: string): Promise<boolean>;
}

export type { ResetResult };
