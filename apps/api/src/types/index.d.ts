/**
 * Buddy Wallet API Type Definitions
 *
 * All shared types and interfaces for the API
 */

// Re-export all types from shared packages and local modules
export * from './rate-limit';
export * from './trace';
export * from './pagination';
export * from './elysia';
export * from '@/app/Repositories/Contracts';
export * from '@repo/types';

// Standard Foundation (Shared)
export type {
  BaseResult,
  ApiResponse,
  PaginatedResult as PaginatedResponse,
  JWTPayload,
  PaginationOptions
} from '@repo/types';

// Service Types - re-export from @repo/types
export type {
  EmailFrom,
  EmailOptions,
  EmailSendResult,
  JobType,
  JobPayload
} from '@repo/types';

// App type (exported from index.ts)
import type { Elysia } from 'elysia';

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


