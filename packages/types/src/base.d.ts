/**
 * Base Shared Type Definitions
 * 
 * Fundamental building blocks for API responses and common patterns.
 */

/**
 * Base result for all service and API operations
 */
export interface BaseResult {
  success: boolean;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> extends BaseResult {
  data?: T;
}

/**
 * Common pagination options for queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated result structure
 */
export interface PaginatedResult<T> extends BaseResult {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Standard JWT Payload structure
 */
export interface JWTPayload {
  id: string;
  phoneNumber: string;
  sessionVersion: number;
  iat?: number;
  exp?: number;
}
