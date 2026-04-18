/**
 * User Domain Exceptions
 *
 * Domain-specific exception classes for User-related errors
 */

import { NotFoundException, ConflictException, UnauthorizedException } from '../index';

/**
 * User not found
 */
export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super('User', userId);
    this.code = 'USER_NOT_FOUND';
    this.name = 'UserNotFoundException';
  }
}

/**
 * User cannot perform action in their current state
 */
export class UserInvalidStateException extends UnauthorizedException {
  constructor(reason: string) {
    super(reason, 'USER_INVALID_STATE');
    this.name = 'UserInvalidStateException';
  }
}

/**
 * User already exists
 */
export class UserDuplicateException extends ConflictException {
  constructor(identifier: string, type: 'email' | 'phone' = 'email') {
    super(
      `User with ${type} ${identifier} already exists`,
      `USER_${type.toUpperCase()}_EXISTS`
    );
    this.name = 'UserDuplicateException';
  }
}

/**
 * User deleted or deactivated
 */
export class UserDeletedException extends UnauthorizedException {
  constructor() {
    super('User account has been deleted', 'USER_DELETED');
    this.name = 'UserDeletedException';
  }
}

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
