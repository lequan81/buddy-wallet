/**
 * Buddy Wallet API Type Definitions
 *
 * All shared types and interfaces for the API
 */

// Re-export all types from shared packages and local modules
export * from './rate-limit';
export * from './trace';
export * from './pagination';
export * from './services/common';
export * from './services/activity';
export * from './services/auth';
export * from './services/debt';
export * from './services/image';
export * from './services/import';
export * from './services/storage';
export * from './repositories';
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
export type { EmailFrom, EmailOptions, EmailSendResult } from '@repo/types';
export type { JobType, JobPayload } from '@repo/types';

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

