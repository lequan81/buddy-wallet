import { ValidationException } from '../index';

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
