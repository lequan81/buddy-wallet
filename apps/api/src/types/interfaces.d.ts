/**
 * Service Interfaces (LSP Compliance)
 *
 * These interfaces define contracts for all services, enabling:
 * - Substitutability (mock implementations for testing)
 * - Decorator pattern (wrap services with logging, caching, etc.)
 * - Dependency inversion (depend on abstractions, not concretions)
 */
import type { Debt, User } from '@repo/db';
import type { JwtService, DbClient } from './services/common';
import type { RegisterInput, LoginInput, AuthResult } from './services/auth';
import type { CreateDebtInput, DebtResult, StatusUpdateResult, DebtStatus } from './services/debt';
import type { SessionInfo } from './services/session';
import type { SafeUser, UserResult } from './services/user';
import type { ExportFormat, ExportResult } from './services/export';
import type { PreviewResult, ImportResult, ProgressResult, ColumnMapping } from './services/import';

/**
 * Current user context for authorization
 */
export interface CurrentUser {
  id: string;
  phoneNumber: string | null;
  permissions: string[];
}

/**
 * Request metadata for session tracking
 */
export interface RequestInfo {
  userAgent: string | null;
  clientIP: string | null;
}

// ============================================
// AUTH SERVICE INTERFACE
// ============================================

export interface IAuthService {
  /**
   * Register a new user
   */
  register(input: RegisterInput): Promise<AuthResult>;

  /**
   * Login a user and create a session
   */
  login(input: LoginInput, jwt: JwtService): Promise<AuthResult & { sessionId?: string }>;

  /**
   * Logout - revoke a session by refresh token
   */
  logout(refreshToken: string, userId?: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Change user password and optionally revoke other sessions
   */
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<{ success: boolean; error?: string }>;
}

// ============================================
// SESSION SERVICE INTERFACE
// ============================================

export interface RefreshSessionResult {
  success: boolean;
  error?: string;
  user?: { id: string; email: string | null; role: string };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface ISessionService {
  /**
   * Refresh an access token using a refresh token
   * Implements refresh token rotation for security
   */
  refreshSession(
    refreshToken: string,
    jwt: JwtService,
    requestInfo: RequestInfo
  ): Promise<RefreshSessionResult>;

  /**
   * Get all active sessions for a user
   */
  getUserSessions(
    userId: string,
    currentRefreshToken?: string
  ): Promise<{ sessions: SessionInfo[]; currentSessionId: string | null }>;

  /**
   * Revoke a specific session
   */
  revokeSession(
    sessionId: string,
    userId: string,
    currentRefreshToken?: string
  ): Promise<{ success: boolean; error?: string; isCurrent?: boolean }>;

  /**
   * Revoke all sessions for a user
   */
  revokeAllSessions(userId: string): Promise<{ success: boolean; count: number }>;
}

// ============================================
// DEBT SERVICE INTERFACE
// ============================================

interface PaginationOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IDebtService {
  /**
   * Get debts for a user (filtered by permissions) with pagination
   */
  getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Debt>>;

  /**
   * Get debts for a specific user (admin only) with pagination
   */
  getDebtsByUserId(userId: string, options?: PaginationOptions): Promise<PaginatedResult<Debt>>;

  /**
   * Count active debts for a phone number (public lookup)
   */
  countActiveDebtsForPhone(phone: string): Promise<number>;

  /**
   * Get a single debt by ID
   */
  getDebtById(debtId: string): Promise<Debt | undefined>;

  /**
   * Create a new debt
   */
  createDebt(input: CreateDebtInput, currentUser: CurrentUser): Promise<DebtResult>;

  /**
   * Update debt status with transition validation
   */
  updateDebtStatus(
    debtId: string,
    newStatus: DebtStatus,
    currentUser: CurrentUser
  ): Promise<StatusUpdateResult>;
}

// ============================================
// USER SERVICE INTERFACE
// ============================================

export interface IUserService {
  /**
   * Get all users (admin only) with pagination
   */
  getAllUsers(options?: { limit?: number; offset?: number }): Promise<{ users: SafeUser[]; total: number; hasMore: boolean }>;

  /**
   * Get a single user by ID with caching
   */
  getUserById(userId: string): Promise<UserResult>;

  /**
   * Toggle user active status
   */
  toggleUserStatus(userId: string): Promise<UserResult>;

  /**
   * Update user permissions
   */
  updateUserPermissions?(userId: string, permissions: string[]): Promise<UserResult>;
}

// ============================================
// EXPORT SERVICE INTERFACE
// ============================================

export interface IExportService {
  /**
   * Export debts for a user in specified format
   */
  exportDebts(userId: string, format: ExportFormat): Promise<ExportResult>;

  /**
   * Export all debts (admin only)
   */
  exportAllDebts?(format: ExportFormat): Promise<ExportResult>;
}

// ============================================
// IMPORT SERVICE INTERFACE
// ============================================

export interface IImportService {
  /**
   * Preview file contents before import
   */
  previewFile(
    fileBuffer: ArrayBuffer,
    filename: string,
    userId: string
  ): Promise<PreviewResult>;

  /**
   * Import debts from a file with column mapping
   */
  importDebts(
    userId: string,
    importId: string,
    columnMapping: ColumnMapping,
    userPhoneNumber: string
  ): Promise<ImportResult>;

  /**
   * Get import progress
   */
  getImportProgress(importId: string): Promise<ProgressResult>;
}

// ============================================
// FACTORY TYPE FOR DEPENDENCY INJECTION
// ============================================

export interface ServiceFactory {
  createAuthService(db: DbClient): IAuthService;
  createSessionService(db: DbClient): ISessionService;
  createDebtService(db: DbClient): IDebtService;
  createUserService(db: DbClient): IUserService;
  createExportService(db: DbClient): IExportService;
  createImportService(db: DbClient): IImportService;
}
