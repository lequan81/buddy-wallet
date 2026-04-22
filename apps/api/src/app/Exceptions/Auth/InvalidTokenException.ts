import { UnauthorizedException } from '../index';

/**
 * Invalid or expired OTP/verification token
 */
export class InvalidTokenException extends UnauthorizedException {
  constructor(tokenType: string = 'Token') {
    super(`${tokenType} is invalid or expired`, 'INVALID_TOKEN');
    this.name = 'InvalidTokenException';
  }
}
