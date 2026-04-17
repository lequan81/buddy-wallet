import { logger } from '@repo/logger';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

class CircuitBreakerState {
  private failures = 0;
  private lastFailure?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private options: CircuitBreakerOptions) {}

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure! > this.options.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }
}

export function CircuitBreaker(options: CircuitBreakerOptions) {
  const breaker = new CircuitBreakerState(options);
  
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!breaker.canExecute()) {
        throw new Error(`Circuit breaker OPEN for ${target.constructor.name}.${propertyKey}`);
      }
      
      try {
        const result = await original.apply(this, args);
        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure();
        throw error;
      }
    };
  };
}
