import { HttpException } from './HttpException';

/**
 * 500 Internal Server Error
 */
export class InternalException extends HttpException {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
    super(500, message, code);
    this.name = 'InternalException';
  }
}
