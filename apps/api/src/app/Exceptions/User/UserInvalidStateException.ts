import { UnauthorizedException } from '../index';

/**
 * User cannot perform action in their current state
 */
export class UserInvalidStateException extends UnauthorizedException {
  constructor(reason: string) {
    super(reason, 'USER_INVALID_STATE');
    this.name = 'UserInvalidStateException';
  }
}
