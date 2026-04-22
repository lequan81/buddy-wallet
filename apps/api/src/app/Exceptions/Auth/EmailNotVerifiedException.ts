import { UnauthorizedException } from '../index';

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
