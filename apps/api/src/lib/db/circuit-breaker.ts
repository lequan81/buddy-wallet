import { logger } from '@repo/logger';

/**
 * Database-specific circuit breaker
 * Monitors database connection failures and prevents cascading failures
 */
interface DbCircuitBreakerOptions {
  failureThreshold?: number;  // Default: 5 failures
  resetTimeoutMs?: number;    // Default: 60000ms (1 minute)
  detectionWindow?: number;   // Default: 30000ms (30 seconds)
}

class DbCircuitBreakerState {
  private failures = 0;
  private lastFailure?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureWindow: number[];

  constructor(private options: DbCircuitBreakerOptions) {
    this.failureWindow = [];
  }

  canExecute(): boolean {
    this.cleanOldFailures();

    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (this.lastFailure && Date.now() - this.lastFailure > (this.options.resetTimeoutMs || 60000)) {
        this.state = 'half-open';
        logger.warn('Database circuit breaker entering half-open state');
        return true;
      }
      return false;
    }
    return true; // half-open
  }

  recordSuccess() {
    this.failures = 0;
    this.failureWindow = [];
    if (this.state !== 'closed') {
      this.state = 'closed';
      logger.info('Database circuit breaker reset to closed');
    }
  }

  recordFailure() {
    this.lastFailure = Date.now();
    this.failureWindow.push(this.lastFailure);
    this.failures++;

    if (this.failures >= (this.options.failureThreshold || 5)) {
      this.state = 'open';
      logger.error('Database circuit breaker OPEN - database unavailable', {
        failures: this.failures
      });
    }
  }

  private cleanOldFailures() {
    const now = Date.now();
    const window = this.options.detectionWindow || 30000;
    this.failureWindow = this.failureWindow.filter(t => now - t < window);
    this.failures = this.failureWindow.length;
  }

  getState() {
    return { state: this.state, failures: this.failures };
  }
}

export function DbCircuitBreaker(options: DbCircuitBreakerOptions = {}) {
  const breaker = new DbCircuitBreakerState(options);

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!breaker.canExecute()) {
        throw new Error(
          `Database circuit breaker OPEN - ${target.constructor.name}.${propertyKey}`
        );
      }

      try {
        const result = await original.apply(this, args);
        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure();
        logger.error(`${target.constructor.name}.${propertyKey} failed`, {
          error: String(error),
          state: breaker.getState()
        });
        throw error;
      }
    };

    return descriptor;
  };
}
