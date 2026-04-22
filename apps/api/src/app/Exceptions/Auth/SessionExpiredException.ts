import { UnauthorizedException } from '../index';

/**
 * Session expired
 */
export class SessionExpiredException extends UnauthorizedException {
  constructor() {
    super('Your session has expired. Please login again.', 'SESSION_EXPIRED');
    this.name = 'SessionExpiredException';
  }
}
