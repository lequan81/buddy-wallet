/**
 * @Timed Decorator - Timeout protection for async methods
 * Automatically fails if method takes longer than specified milliseconds
 * Performance: O(1) timeout check using Promise.race
 */

import { logger } from '@repo/logger';

export interface TimedOptions {
  ms: number;
  fallback?: () => any;
}

/**
 * TimedError - Thrown when method exceeds timeout
 */
export class TimedError extends Error {
  constructor(methodName: string, timeoutMs: number) {
    super(`${methodName} exceeded timeout of ${timeoutMs}ms`);
    this.name = 'TimedError';
  }
}

/**
 * Apply timeout protection to async methods
 * Usage:
 *   @Timed({ ms: 5000 })
 *   async getUserData() { ... }
 */
export function Timed(options: TimedOptions | number, fallback?: () => any) {
  // Support both old and new API
  const opts = typeof options === 'number'
    ? { ms: options, fallback }
    : options;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = `${className}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();

      try {
        // Race original promise against timeout
        const result = await Promise.race([
          originalMethod.apply(this, args),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new TimedError(methodName, opts.ms)),
              opts.ms
            )
          )
        ]);

        const duration = Date.now() - startTime;

        // Log slow executions (80% of timeout)
        if (duration > opts.ms * 0.8) {
          logger.warn(`Slow method execution: ${methodName}`, {
            duration,
            timeout: opts.ms,
            percentOfTimeout: Math.round((duration / opts.ms) * 100) + '%'
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Check if timeout occurred
        if (error instanceof TimedError) {
          logger.error(`Method timeout: ${methodName}`, {
            duration,
            timeoutMs: opts.ms
          });

          // Use fallback if provided
          if (opts.fallback) {
            logger.info(`Using fallback for ${methodName}`);
            return opts.fallback();
          }

          throw error;
        }

        // Re-throw original errors
        throw error;
      }
    };

    return descriptor;
  };
}

