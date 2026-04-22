import { HttpException } from './HttpException';

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
