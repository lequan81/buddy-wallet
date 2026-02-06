/**
 * Buddy Wallet API Type Definitions
 *
 * All shared types and interfaces for the API
 */

// Re-export all types
export * from './logger';
export * from './rate-limit';
export * from './trace';
export * from './import';
// Service Types
export * from './services/common';
/// <reference path="./web-push.d.ts" />
export * from './services/auth';
export * from './services/debt';
export * from './services/export';
export * from './services/session';
export * from './services/user';
export * from './services/import';
// Service Interfaces (LSP) - Dedicated location
export * from './interfaces';
// Debt State Types (OCP) - Dedicated location
export * from './debt-state';

// App type (exported from index.ts)
import type { Elysia } from 'elysia';

/**
 * Base API response
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  id: string;
  iat?: number;
  exp?: number;
}

/**
 * Request context with authenticated user
 */
export interface AuthenticatedContext {
  user: {
    id: string;
    email: string | null;
    name: string;
    role: 'user' | 'admin';
    permissions: string[];
  } | null;
  sessionId: string | null;
}
