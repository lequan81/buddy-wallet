import { isNull, and, type SQL, type AnyColumn } from '@repo/db';

/**
 * SoftDeletePlugin - Shared logic for soft-deletion across repositories.
 * 
 * Mimics Laravel's SoftDeletes trait using functional composition.
 */
export const SoftDeletePlugin = {
  /**
   * Applies a soft-delete check to an array of SQL conditions.
   * By default, it filters out records where deletedAt is not null.
   */
  applyCheck(
    conditions: SQL[],
    deletedAtColumn: AnyColumn,
    includeDeleted = false
  ): SQL[] {
    if (!includeDeleted) {
      conditions.push(isNull(deletedAtColumn));
    }
    return conditions;
  },

  /**
   * Wraps an existing condition with a soft-delete check.
   */
  filter(
    condition: SQL | undefined,
    deletedAtColumn: AnyColumn,
    includeDeleted = false
  ): SQL | undefined {
    if (includeDeleted) return condition;
    
    const check = isNull(deletedAtColumn);
    return condition ? and(condition, check) : check;
  }
};
