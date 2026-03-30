/**
 * Resilience Utility - Unified Retry Logic
 * 
 * Standardizes exponential backoff and retry behavior across the monorepo.
 */

export interface RetryConfig<T> {
  /** Maximum number of attempts including the first one */
  maxAttempts: number;
  /** Initial delay in milliseconds for the first retry */
  baseDelayMs: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs: number;
  /** Optional callback for each failed attempt */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Optional value to return if all retries fail */
  fallbackValue?: T;
}

/**
 * Executes an operation with exponential backoff retry logic.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt >= config.maxAttempts) {
        if (config.fallbackValue !== undefined) {
          return config.fallbackValue;
        }
        break;
      }

      if (config.onRetry) {
        config.onRetry(error, attempt);
      }

      const delayMs = Math.min(
        config.baseDelayMs * Math.pow(2, attempt - 1),
        config.maxDelayMs
      );
      
      // Use Bun.sleep if available, otherwise fallback to setTimeout
      if (typeof Bun !== 'undefined') {
        await Bun.sleep(delayMs);
      } else {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
