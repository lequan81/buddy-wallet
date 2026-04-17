/**
 * User DB Row to Domain Model Mapper
 *
 * Converts database rows to rich User domain models.
 */

import type { User as UserRow } from '@repo/db';
import { User } from '@/app/Models/User';

export class DbRowToUserMapper {
  /**
   * Convert database row to User domain model
   */
  static toDomain(row: UserRow): User {
    return new User(
      row.id,
      row.phoneNumber,
      row.name,
      row.role as 'user' | 'admin',
      row.email || undefined,
      row.permissions ? JSON.parse(row.permissions as any) : [],
      new Date(row.createdAt),
      new Date(row.updatedAt),
      row.deletedAt ? new Date(row.deletedAt) : undefined
    );
  }

  /**
   * Convert multiple rows to domain models
   */
  static toDomainMany(rows: UserRow[]): User[] {
    return rows.map((row) => this.toDomain(row));
  }
}
