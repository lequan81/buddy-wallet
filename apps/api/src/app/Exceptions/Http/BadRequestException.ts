import { HttpException } from './HttpException';

/**
 * 400 Bad Request
 */
export class BadRequestException extends HttpException {
  constructor(message: string, code: string = 'BAD_REQUEST') {
    super(400, message, code);
    this.name = 'BadRequestException';
  }
}
