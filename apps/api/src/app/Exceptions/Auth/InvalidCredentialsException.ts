import { UnauthorizedException } from '../index';

/**
 * Invalid credentials (email/password)
 */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Email or password is incorrect', 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsException';
  }
}
