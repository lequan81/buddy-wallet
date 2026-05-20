/**
 * API Commons Types
 */

import type { UserResponse } from '../shared/user';
import type { Server } from 'bun';

export type ErrorLike = { code: string; message?: string; error?: string; status?: number };

export type ActivityAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout' | 'login_failed'
  | 'export' | 'import' | 'import_preview' | 'status_change'
  | 'password_change' | 'logout_all' | 'delete_all'
  | 'register' | 'verify_email' | 'revoke_session'
  | 'confirm' | 'suggest_edit' | 'accept_suggestion' | 'reject_suggestion'
  | 'upload' | 'approve' | 'reject'
  | 'subscribe' | 'unsubscribe' | 'broadcast';

export type ActivityResource =
  | 'debt' | 'user' | 'session' | 'import' | 'export'
  | 'bank_account' | 'file' | 'push_subscription';

export interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  resource: ActivityResource;
  resourceId?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RateLimitContext {
  user?: { id: string };
  server?: Server<any>;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request, ctx?: RateLimitContext) => string | Promise<string>;
  skip?: (request: Request, ctx?: RateLimitContext) => boolean;
  message?: string;
}

export interface AccessControlContext {
  actor: UserResponse | null;
  params: Record<string, string>;
  set: { status: number };
}
