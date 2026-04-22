import { UnauthorizedException } from '../index';

/**
 * User account suspended
 */
export class UserSuspendedException extends UnauthorizedException {
  constructor(reason?: string) {
    super(
      reason || 'User account has been suspended',
      'USER_SUSPENDED'
    );
    this.name = 'UserSuspendedException';
  }
}
