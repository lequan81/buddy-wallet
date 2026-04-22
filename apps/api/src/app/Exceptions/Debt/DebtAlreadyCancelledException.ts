import { ConflictException } from '../index';

/**
 * Debt already cancelled (status transition conflict)
 */
export class DebtAlreadyCancelledException extends ConflictException {
  constructor(debtId: string) {
    super(`Debt ${debtId} has already been cancelled`, 'DEBT_ALREADY_CANCELLED');
    this.name = 'DebtAlreadyCancelledException';
  }
}
