import { NotFoundException } from '../index';

/**
 * Debt not found
 */
export class DebtNotFoundException extends NotFoundException {
  constructor(debtId: string) {
    super('Debt', debtId);
    this.name = 'DebtNotFoundException';
  }
}
