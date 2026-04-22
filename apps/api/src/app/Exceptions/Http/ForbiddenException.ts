import { HttpException } from './HttpException';

/**
 * 403 Forbidden
 */
export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(403, message, code);
    this.name = 'ForbiddenException';
  }
}
