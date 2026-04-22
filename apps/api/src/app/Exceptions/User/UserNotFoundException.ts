import { NotFoundException } from '../index';

/**
 * User not found
 */
export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super('User', userId);
    this.name = 'UserNotFoundException';
  }
}
