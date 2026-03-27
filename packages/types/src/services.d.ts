/// <reference types="./debt" />
/// <reference types="./user" />
/// <reference types="./session" />
/// <reference types="./api" />
/// <reference types="./device" />

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
  clientHints?: import('./device').ClientHints;
  coordinates?: import('./device').Coordinates | null;
  clientLocation?: import('./device').ClientLocation;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  expiresIn?: number;
  user?: import('./user').SafeUser;
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
  user?: import('./user').SafeUser;
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
  ): Promise<{ sessions: import('./session').SessionInfo[]; currentSessionId: string | null }>;
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
    options?: import('./api').PaginationOptions
  ): Promise<import('./api').PaginatedResult<import('./debt').DebtDetails>>;
  getDebtsByUserId(userId: string, options?: import('./api').PaginationOptions): Promise<import('./api').PaginatedResult<import('./debt').DebtDetails>>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  getDebtById(debtId: string): Promise<import('./debt').DebtDetails | undefined>;
  createDebt(input: import('./debt').CreateDebtInput & { expiryOption?: import('./api').ExpiryOption; confirmDuplicate?: boolean }, currentUser: import('./user').SafeUser): Promise<import('./debt').DebtResult>;
  updateDebtStatus(debtId: string, newStatus: import('./debt').DebtStatus, currentUser: import('./user').SafeUser): Promise<import('./debt').StatusUpdateResult>;
}

export interface IUserService {
  getAllUsers(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ users: import('./user').SafeUser[]; total: number; hasMore: boolean }>;
  getUserById(userId: string): Promise<import('./user').UserResult>;
  toggleUserStatus(userId: string): Promise<import('./user').UserResult>;
  updateUserPermissions?(userId: string, permissions: string[]): Promise<import('./user').UserResult>;
}

export interface ResetResult {
  success: boolean;
  error?: string;
}
