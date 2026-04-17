/**
 * Debt DB Row to Domain Model Mapper
 *
 * Converts database rows to rich Debt domain models with business logic.
 */

import type { DebtRow } from '@repo/db';
import { Debt } from '@/app/Models/Debt';

export class DbRowToDebtMapper {
  /**
   * Convert database row to Debt domain model
   */
  static toDomain(row: DebtRow): Debt {
    return new Debt(
      row.id,
      row.amount,
      row.currency,
      row.debtorId,
      row.creditorId,
      row.status as any,
      new Date(row.createdAt),
      new Date(row.updatedAt),
      row.description
    );
  }

  /**
   * Convert multiple rows to domain models
   */
  static toDomainMany(rows: DebtRow[]): Debt[] {
    return rows.map((row) => this.toDomain(row));
  }
}
