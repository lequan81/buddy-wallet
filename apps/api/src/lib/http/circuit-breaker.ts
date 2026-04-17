import { logger } from '@repo/logger';

/**
 * HTTP-specific circuit breaker
 * Monitors external API calls (VietQR, Email services, etc.)
 */
interface HttpCircuitBreakerOptions {
  failureThreshold?: number;  // Default: 5 failures
  resetTimeoutMs?: number;    // Default: 120000ms (2 minutes)
  detectionWindow?: number;   // Default: 60000ms (1 minute)
  serviceName?: string;       // For logging
}

class HttpCircuitBreakerState {
  private failures = 0;
  private lastFailure?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureWindow: number[];

  constructor(private options: HttpCircuitBreakerOptions) {
    this.failureWindow = [];
  }

  canExecute(): boolean {
    this.cleanOldFailures();

    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (this.lastFailure && Date.now() - this.lastFailure > (this.options.resetTimeoutMs || 120000)) {
        this.state = 'half-open';
        logger.warn(
          `${this.options.serviceName || 'External API'} circuit breaker entering half-open state`
        );
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
      logger.info(
        `${this.options.serviceName || 'External API'} circuit breaker reset to closed`
      );
    }
  }

  recordFailure() {
    this.lastFailure = Date.now();
    this.failureWindow.push(this.lastFailure);
    this.failures++;

    if (this.failures >= (this.options.failureThreshold || 5)) {
      this.state = 'open';
      logger.error(
        `${this.options.serviceName || 'External API'} circuit breaker OPEN`,
        { failures: this.failures }
      );
    }
  }

  private cleanOldFailures() {
    const now = Date.now();
    const window = this.options.detectionWindow || 60000;
    this.failureWindow = this.failureWindow.filter(t => now - t < window);
    this.failures = this.failureWindow.length;
  }

  getState() {
    return { state: this.state, failures: this.failures };
  }
}

export function HttpCircuitBreaker(options: HttpCircuitBreakerOptions = {}) {
  const breaker = new HttpCircuitBreakerState(options);

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!breaker.canExecute()) {
        throw new Error(
          `${options.serviceName || 'HTTP'} circuit breaker OPEN - ${target.constructor.name}.${propertyKey}`
        );
      }

      try {
        const result = await original.apply(this, args);
        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure();
        logger.error(
          `${target.constructor.name}.${propertyKey} failed`,
          {
            error: String(error),
            service: options.serviceName,
            state: breaker.getState()
          }
        );
        throw error;
      }
    };

    return descriptor;
  };
}
