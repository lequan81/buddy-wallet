/**
 * Database Circuit Breaker
 *
 * Monitors database connection health and fails fast when connection issues detected.
 * Prevents cascading failures from database outages.
 */

import { logger } from '@repo/logger';

export interface DbCircuitBreakerConfig {
  failureThreshold: number; // Open after N failures
  resetTimeoutMs: number; // Try reconnect after MS
  monitoringIntervalMs: number; // Check health every MS
}

export enum DbCircuitBreakerState {
  CLOSED = 'closed', // Operating normally
  OPEN = 'open', // Database unavailable, reject requests
  HALF_OPEN = 'half-open' // Testing if database recovered
}

/**
 * Database circuit breaker implementation
 * Monitors connection pool and database query failures
 */
export class DbCircuitBreaker {
  private state: DbCircuitBreakerState = DbCircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: number;
  private readonly config: DbCircuitBreakerConfig;

  constructor(config: DbCircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Check if requests can proceed
   */
  canExecute(): boolean {
    if (this.state === DbCircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === DbCircuitBreakerState.OPEN) {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.setState(DbCircuitBreakerState.HALF_OPEN);
        logger.warn('Database circuit breaker: Attempting recovery (HALF_OPEN)');
        return true;
      }
      return false;
    }

    return true; // HALF_OPEN allows one request to test
  }

  /**
   * Record successful database operation
   */
  recordSuccess(): void {
    if (this.state === DbCircuitBreakerState.HALF_OPEN) {
      logger.info('Database circuit breaker: Connection recovered (CLOSED)');
    }

    this.failureCount = 0;
    this.setState(DbCircuitBreakerState.CLOSED);
  }

  /**
   * Record failed database operation
   */
  recordFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    logger.warn(`Database circuit breaker failure #${this.failureCount}`, {
      error: error.message,
      state: this.state
    });

    if (this.failureCount >= this.config.failureThreshold) {
      this.setState(DbCircuitBreakerState.OPEN);
      logger.error('Database circuit breaker OPENED - database unavailable', {
        failures: this.failureCount,
        threshold: this.config.failureThreshold
      });
    }
  }

  /**
   * Get current state
   */
  getState(): DbCircuitBreakerState {
    return this.state;
  }

  /**
   * Reset circuit breaker (admin only)
   */
  reset(): void {
    this.setState(DbCircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    logger.info('Database circuit breaker manually reset');
  }

  private setState(newState: DbCircuitBreakerState): void {
    if (newState !== this.state) {
      logger.warn(`Database circuit breaker state: ${this.state} → ${newState}`);
      this.state = newState;
    }
  }
}
