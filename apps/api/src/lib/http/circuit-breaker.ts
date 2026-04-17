/**
 * HTTP Circuit Breaker
 *
 * Monitors external HTTP API health (VietQR, Email service, etc.)
 * Prevents cascading failures when external services are down.
 */

import { logger } from '@repo/logger';

export interface HttpCircuitBreakerConfig {
  failureThreshold: number; // Open after N failures
  resetTimeoutMs: number; // Try reconnect after MS
  successThresholdHalfOpen: number; // N successful calls to close from half-open
}

export enum HttpCircuitBreakerState {
  CLOSED = 'closed', // Service operating normally
  OPEN = 'open', // Service unavailable, reject requests
  HALF_OPEN = 'half-open' // Testing if service recovered
}

/**
 * HTTP circuit breaker for external API calls
 * Monitors request failures and tracks service health
 */
export class HttpCircuitBreaker {
  private state: HttpCircuitBreakerState = HttpCircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private readonly serviceName: string;
  private readonly config: HttpCircuitBreakerConfig;

  constructor(serviceName: string, config: HttpCircuitBreakerConfig) {
    this.serviceName = serviceName;
    this.config = config;
  }

  /**
   * Check if request can proceed to external service
   */
  canExecute(): boolean {
    if (this.state === HttpCircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === HttpCircuitBreakerState.OPEN) {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.setState(HttpCircuitBreakerState.HALF_OPEN);
        logger.warn(`${this.serviceName} circuit breaker: Attempting recovery (HALF_OPEN)`);
        this.successCount = 0;
        return true;
      }
      return false;
    }

    return true; // HALF_OPEN allows requests to test
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === HttpCircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThresholdHalfOpen) {
        this.setState(HttpCircuitBreakerState.CLOSED);
        logger.info(`${this.serviceName} circuit breaker: Service recovered (CLOSED)`);
      }
    } else if (this.state === HttpCircuitBreakerState.CLOSED) {
      this.successCount = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    logger.warn(`${this.serviceName} circuit breaker failure #${this.failureCount}`, {
      error: error.message,
      state: this.state
    });

    if (this.failureCount >= this.config.failureThreshold) {
      this.setState(HttpCircuitBreakerState.OPEN);
      logger.error(`${this.serviceName} circuit breaker OPENED`, {
        failures: this.failureCount,
        threshold: this.config.failureThreshold,
        resetAfter: `${this.config.resetTimeoutMs}ms`
      });
    }
  }

  /**
   * Get current state
   */
  getState(): HttpCircuitBreakerState {
    return this.state;
  }

  /**
   * Get health status for monitoring
   */
  getStatus(): {
    serviceName: string;
    state: HttpCircuitBreakerState;
    failureCount: number;
    lastFailureTime?: number;
  } {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker (admin only)
   */
  reset(): void {
    this.setState(HttpCircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    logger.info(`${this.serviceName} circuit breaker manually reset`);
  }

  private setState(newState: HttpCircuitBreakerState): void {
    if (newState !== this.state) {
      logger.warn(`${this.serviceName} circuit breaker state: ${this.state} → ${newState}`);
      this.state = newState;
    }
  }
}
