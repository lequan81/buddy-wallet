/**
 * Data/Import-Export Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Export data query schema
export const ExportDataQuerySchema = t.Object({
  type: t.Union([
    t.Literal('debts'),
    t.Literal('users'),
    t.Literal('bank-accounts')
  ]),
  format: t.Union([
    t.Literal('json'),
    t.Literal('csv')
  ], { default: 'json' }),
  startDate: t.Optional(t.String()),
  endDate: t.Optional(t.String())
});

// Import data schema
export const ImportDataSchema = t.Object({
  type: t.Union([
    t.Literal('debts'),
    t.Literal('users'),
    t.Literal('bank-accounts')
  ]),
  format: t.Union([
    t.Literal('json'),
    t.Literal('csv')
  ]),
  data: t.Unknown()
});

// Response schemas
export const ExportDataResponseSchema = t.Object({
  data: t.Unknown(),
  meta: t.Object({
    type: t.String(),
    format: t.String(),
    count: t.Number(),
    exportedAt: t.Date()
  })
});

export const ImportDataResponseSchema = t.Object({
  data: t.Object({
    imported: t.Number(),
    failed: t.Number(),
    errors: t.Optional(t.Array(t.Unknown()))
  })
});
