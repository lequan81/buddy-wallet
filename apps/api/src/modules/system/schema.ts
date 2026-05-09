/**
 * System Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// Health check response schema
export const HealthResponseSchema = v.object({
  status: v.picklist(['healthy', 'unhealthy', 'degraded']),
  timestamp: v.date(),
  uptime: v.number(),
  version: v.string(),
  environment: v.string(),
  services: v.object({
    database: v.picklist(['up', 'down']),
    redis: v.picklist(['up', 'down']),
    storage: v.picklist(['up', 'down'])
  })
});

// System info response schema
export const SystemInfoResponseSchema = v.object({
  version: v.string(),
  environment: v.string(),
  nodeVersion: v.string(),
  platform: v.string(),
  architecture: v.string(),
  uptime: v.number(),
  memory: v.object({
    used: v.number(),
    total: v.number(),
    percentage: v.number()
  }),
  cpu: v.object({
    cores: v.number(),
    usage: v.number()
  })
});
