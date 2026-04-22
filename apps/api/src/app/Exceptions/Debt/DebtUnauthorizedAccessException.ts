import { ForbiddenException } from '../index';

/**
 * User does not have permission to perform debt operation
 */
export class DebtUnauthorizedAccessException extends ForbiddenException {
  constructor(reason?: string) {
    super(
      reason || 'You do not have permission to perform this action on this debt',
      'DEBT_UNAUTHORIZED_ACCESS'
    );
    this.name = 'DebtUnauthorizedAccessException';
  }
}
