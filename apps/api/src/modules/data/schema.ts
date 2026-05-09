/**
 * Data/Import-Export Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// Export data query schema
export const ExportDataQuerySchema = v.object({
  type: v.picklist(['debts', 'users', 'bank-accounts']),
  format: v.optional(v.picklist(['json', 'csv'])),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string())
});

// Import data schema
export const ImportDataSchema = v.object({
  type: v.picklist(['debts', 'users', 'bank-accounts']),
  format: v.picklist(['json', 'csv']),
  data: v.unknown()
});

// Response schemas
export const ExportDataResponseSchema = v.object({
  data: v.unknown(),
  meta: v.object({
    type: v.string(),
    format: v.string(),
    count: v.number(),
    exportedAt: v.date()
  })
});

export const ImportDataResponseSchema = v.object({
  data: v.object({
    imported: v.number(),
    failed: v.number(),
    errors: v.optional(v.array(v.unknown()))
  })
});
