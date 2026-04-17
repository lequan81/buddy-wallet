/**
 * HTTP Exceptions
 *
 * Custom exception classes for API errors.
 */

/**
 * Base HTTP exception
 */
export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code: string = 'HTTP_ERROR'
  ) {
    super(message);
    this.name = 'HttpException';
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestException extends HttpException {
  constructor(message: string, code: string = 'BAD_REQUEST') {
    super(400, message, code);
    this.name = 'BadRequestException';
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(401, message, code);
    this.name = 'UnauthorizedException';
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(403, message, code);
    this.name = 'ForbiddenException';
  }
}

/**
 * 404 Not Found
 */
export class NotFoundException extends HttpException {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundException';
  }
}

/**
 * 409 Conflict
 */
export class ConflictException extends HttpException {
  constructor(message: string, code: string = 'CONFLICT') {
    super(409, message, code);
    this.name = 'ConflictException';
  }
}

/**
 * 422 Unprocessable Entity (Validation)
 */
export class ValidationException extends HttpException {
  constructor(
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(422, message, 'VALIDATION_FAILED');
    this.name = 'ValidationException';
  }
}

/**
 * 429 Too Many Requests
 */
export class RateLimitException extends HttpException {
  constructor(
    message: string = 'Too many requests',
    public readonly retryAfter?: number
  ) {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitException';
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalException extends HttpException {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
    super(500, message, code);
    this.name = 'InternalException';
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableException extends HttpException {
  constructor(service: string) {
    super(503, `${service} is temporarily unavailable`, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableException';
  }
}
