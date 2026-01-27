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
export * from './redis';

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
