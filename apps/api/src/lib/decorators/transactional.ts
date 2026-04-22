/**
 * @Transactional Decorator - Database transaction management
 * Automatically wraps method in database transaction
 * Commits on success, rolls back on error
 * Performance: O(1) transaction overhead
 */

import { db } from '@repo/db';
import { logger } from '@repo/logger';

/**
 * TransactionError - Thrown when transaction fails
 */
export class TransactionError extends Error {
  constructor(methodName: string, originalError: Error) {
    super(`Transaction failed in ${methodName}: ${originalError.message}`);
    this.name = 'TransactionError';
    this.cause = originalError;
  }
}

/**
 * Apply transaction wrapper to method
 * Usage:
 *   @Transactional()
 *   async updateDebt(id: string, data: any) { ... }
 *
 * Note: Method will receive transaction as last parameter automatically
 */
export function Transactional() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = `${className}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();

      try {
        logger.debug(`Starting transaction: ${methodName}`);

        const result = await db.transaction(async (trx) => {
          // Inject transaction as last argument
          return await originalMethod.apply(this, [...args, trx]);
        });

        const duration = Date.now() - startTime;
        logger.debug(`Transaction committed: ${methodName}`, {
          duration
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const err = error as Error;

        logger.error(`Transaction failed: ${methodName}`, {
          error: err.message,
          duration,
          stack: err.stack?.split('\n')[1] // Log one stack frame for debugging
        });

        // Re-throw wrapped in context
        throw new TransactionError(methodName, err);
      }
    };

    return descriptor;
  };
}

