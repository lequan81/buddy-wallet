import { HttpException } from './HttpException';

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
