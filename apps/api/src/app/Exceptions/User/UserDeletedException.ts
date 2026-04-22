import { UnauthorizedException } from '../index';

/**
 * User deleted or deactivated
 */
export class UserDeletedException extends UnauthorizedException {
  constructor() {
    super('User account has been deleted', 'USER_DELETED');
    this.name = 'UserDeletedException';
  }
}
