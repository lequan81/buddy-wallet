import { HttpException } from './HttpException';

/**
 * 409 Conflict
 */
export class ConflictException extends HttpException {
  constructor(message: string, code: string = 'CONFLICT') {
    super(409, message, code);
    this.name = 'ConflictException';
  }
}
