export class DomainException extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DomainException';
  }
}

export class RaceConditionException extends DomainException {
  constructor() {
    super('RACE_CONDITION_DEBT_GONE', 'The requested debt record is no longer available.');
  }
}
