/**
 * Buddy Wallet API Type Definitions
 *
 * All shared types and interfaces for the API
 */

// Re-export all types from shared packages
export * from './rate-limit';
export * from './trace';
export * from './services/common';
export * from '@repo/types';

// Service Types - re-export from @repo/types
export type { EmailFrom, EmailOptions, EmailSendResult } from '@repo/types';
export type { JobType, JobPayload } from '@repo/types';

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

