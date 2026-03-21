/**
 * Buddy Wallet API Type Definitions
 *
 * All shared types and interfaces for the API
 */

// Re-export all types
export * from './rate-limit';
export * from './trace';
export * from '@repo/types';

// Service Types
export * from './services/common';
export * from './services/import';
export * from './services/vietqr';
export * from './services/jobs';
export * from './services/password-reset';
export * from './push';
// Services are now in @repo/types

// Debt State Types (OCP) - Dedicated location
export * from './debt-state';

// App type (exported from index.ts)
import type { Elysia } from 'elysia';


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
  phoneNumber: string;
  sessionVersion: number;
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

