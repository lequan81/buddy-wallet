/**
 * System Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Health check response schema
export const HealthResponseSchema = t.Object({
  status: t.Union([t.Literal('healthy'), t.Literal('unhealthy'), t.Literal('degraded')]),
  timestamp: t.Date(),
  uptime: t.Number(),
  version: t.String(),
  environment: t.String(),
  services: t.Object({
    database: t.Union([t.Literal('up'), t.Literal('down')]),
    redis: t.Union([t.Literal('up'), t.Literal('down')]),
    storage: t.Union([t.Literal('up'), t.Literal('down')])
  })
});

// System info response schema
export const SystemInfoResponseSchema = t.Object({
  version: t.String(),
  environment: t.String(),
  nodeVersion: t.String(),
  platform: t.String(),
  architecture: t.String(),
  uptime: t.Number(),
  memory: t.Object({
    used: t.Number(),
    total: t.Number(),
    percentage: t.Number()
  }),
  cpu: t.Object({
    cores: t.Number(),
    usage: t.Number()
  })
});
