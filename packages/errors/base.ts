/**
 * Base utilities and constants for errors
 */

// ============================================
// HTTP STATUS CODE CONSTANTS
// ============================================

export const HTTP_STATUS = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// ============================================
// UTILITIES
// ============================================

/** Check if error code is from frontend */
export const isFrontendError = (code: string): boolean => code.startsWith('FE_');

/** Check if error code is from backend */
export const isBackendError = (code: string): boolean => code.startsWith('BE_');

/** Check if error code is generic */
export const isGenericError = (code: string): boolean => code.startsWith('GEN_');

/** Get error category from code */
export const getErrorCategory = (code: string): 'GEN' | 'FE' | 'BE' | 'UNKNOWN' => {
  if (code.startsWith('GEN_')) return 'GEN';
  if (code.startsWith('FE_')) return 'FE';
  if (code.startsWith('BE_')) return 'BE';
  return 'UNKNOWN';
};

/** Create an error object */
export const createError = (
  error: { code: string; message: string },
  details?: string
) => ({
  code: error.code,
  message: error.message,
  ...(details ? { details } : {})
});

// ============================================
// API RESPONSE HELPERS
// ============================================

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  details?: string;
  timestamp: string;
}

/**
 * Creates a standardized API response object.
 */
export function apiResponse<T>(params: {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  details?: string;
}): ApiResponse<T> {
  return {
    ok: params.ok,
    ...(params.data !== undefined ? { data: params.data } : {}),
    ...(params.error ? { error: params.error } : {}),
    ...(params.details ? { details: params.details } : {}),
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a successful API response.
 */
export function apiSuccess<T>(data: T): ApiResponse<T> {
  return apiResponse({
    ok: true,
    data
  });
}

/**
 * Creates an error API response.
 */
export function apiError(
  error: { code: string; message: string } | { code: string; error?: any },
  details?: string
): ApiResponse<never> {
  if ('message' in error) {
    return apiResponse({
      ok: false,
      error: { code: error.code, message: (error as any).message },
      details: details
    });
  }

  return apiResponse({
    ok: false,
    error: { code: (error as any).code, message: '' },
    details: (error as any).error || details
  });
}

