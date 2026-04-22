import { ForbiddenException } from '../index';

/**
 * Debt operation not allowed in current state
 */
export class DebtCannotBeCancelledException extends ForbiddenException {
  constructor() {
    super('Debt has already been cancelled or confirmed', 'DEBT_CANNOT_BE_CANCELLED');
    this.name = 'DebtCannotBeCancelledException';
  }
}
