/**
 * Auth Domain Exceptions
 *
 * Domain-specific exception classes for Authentication-related errors
 */

import { UnauthorizedException, ConflictException, ValidationException } from '../index';

/**
 * Invalid credentials (email/password)
 */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Email or password is incorrect', 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsException';
  }
}

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

/**
 * User already exists
 */
export class UserAlreadyExistsException extends ConflictException {
  constructor(identifier: string, type: 'email' | 'phone' = 'email') {
    super(
      `User with ${type} ${identifier} already exists`,
      `USER_${type.toUpperCase()}_EXISTS`
    );
    this.name = 'UserAlreadyExistsException';
  }
}

/**
 * Email not verified
 */
export class EmailNotVerifiedException extends UnauthorizedException {
  constructor() {
    super(
      'Email address has not been verified. Please check your email for verification link.',
      'EMAIL_NOT_VERIFIED'
    );
    this.name = 'EmailNotVerifiedException';
  }
}

/**
 * Invalid or expired OTP/verification token
 */
export class InvalidTokenException extends UnauthorizedException {
  constructor(tokenType: string = 'Token') {
    super(`${tokenType} is invalid or expired`, 'INVALID_TOKEN');
    this.name = 'InvalidTokenException';
  }
}

/**
 * Session expired
 */
export class SessionExpiredException extends UnauthorizedException {
  constructor() {
    super('Your session has expired. Please login again.', 'SESSION_EXPIRED');
    this.name = 'SessionExpiredException';
  }
}

/**
 * Password policy violation
 */
export class WeakPasswordException extends ValidationException {
  constructor(requirements: string[]) {
    super(
      'Password does not meet security requirements',
      {
        password: requirements
      }
    );
    this.name = 'WeakPasswordException';
  }
}
