/**
 * Circuit Breaker Module
 *
 * Prevents cascading failures by temporarily disabling Redis
 * after repeated failures.
 */
import { log } from '../../utils/logger';

const MAX_FAILURES = parseInt(Bun.env.REDIS_MAX_FAILURES || '3');
const CIRCUIT_RESET_MS = parseInt(Bun.env.REDIS_CIRCUIT_RESET_MS || '60000');
const DAILY_COMMAND_LIMIT = parseInt(Bun.env.REDIS_DAILY_COMMAND_LIMIT || '9500');
const DAY_MS = 24 * 60 * 60 * 1000;

let failureCount = 0;
let lastFailureTime = 0;
let dailyCommandCount = 0;
let lastCommandReset = Date.now();

export const circuitBreaker = {
  /**
   * Check if circuit is available (not tripped)
   */
  isAvailable(): boolean {
    // Reset circuit after timeout
    if (failureCount >= MAX_FAILURES) {
      if (Date.now() - lastFailureTime > CIRCUIT_RESET_MS) {
        failureCount = 0;
        log.debug('REDIS', 'Circuit breaker reset');
      } else {
        return false;
      }
    }

    // Reset daily counter if new day
    if (Date.now() - lastCommandReset > DAY_MS) {
      dailyCommandCount = 0;
      lastCommandReset = Date.now();
    }

    // Check daily limit
    if (dailyCommandCount >= DAILY_COMMAND_LIMIT) {
      log.warn('REDIS', 'Daily command limit approaching, using in-memory fallback');
      return false;
    }

    return true;
  },

  /**
   * Track command execution
   */
  trackCommand(success: boolean): void {
    dailyCommandCount++;
    if (!success) {
      failureCount++;
      lastFailureTime = Date.now();
    } else if (failureCount > 0) {
      failureCount = Math.max(0, failureCount - 1);
    }
  },

  /**
   * Get stats for monitoring
   */
  getStats() {
    return { dailyCommands: dailyCommandCount, limit: DAILY_COMMAND_LIMIT, failureCount };
  }
};
