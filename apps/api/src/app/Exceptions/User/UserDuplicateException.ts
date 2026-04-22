import { ConflictException } from '../index';

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
