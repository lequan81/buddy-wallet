import { HttpException } from './HttpException';

/**
 * 401 Unauthorized
 */
export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(401, message, code);
    this.name = 'UnauthorizedException';
  }
}
