import { logger } from '@repo/logger';

export interface RetryableOptions {
  maxAttempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  RetryableErrors?: string[];
}

export function Retryable(options: RetryableOptions = {}) {
  const { maxAttempts = 3, backoffMs = 1000, maxBackoffMs = 10000, RetryableErrors } = options;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      const className = target.constructor.name;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          const isRetryable = RetryableErrors
            ? RetryableErrors.some(e => lastError.message.includes(e))
            : true;

          if (!isRetryable || attempt === maxAttempts) {
            logger.warn(`${className}.${propertyKey} failed after ${attempt} attempts`, {
              error: lastError.message
            });
            throw lastError;
          }

          const backoff = Math.min(backoffMs * Math.pow(2, attempt - 1), maxBackoffMs);
          logger.debug(`${className}.${propertyKey} retry ${attempt}/${maxAttempts} after ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}

