import { UnauthorizedException } from '../index';

/**
 * Account locked due to too many failed login attempts
 */
export class AccountLockedException extends UnauthorizedException {
  constructor(minutesUntilUnlock: number) {
    super(
      `Account temporarily locked due to multiple failed login attempts. Try again in ${minutesUntilUnlock} minutes.`,
      'ACCOUNT_LOCKED'
    );
    this.name = 'AccountLockedException';
  }
}
