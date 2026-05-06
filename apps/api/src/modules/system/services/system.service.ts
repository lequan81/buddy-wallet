/**
 * System Service - Pure Functions
 * 
 * Following ElysiaJS functional programming principles:
 * - Pure functions only (no DI, no Elysia context)
 * - Input -> Process -> Output
 * - No side effects in service layer
 * - Database operations passed as parameters
 */

import { db } from '@/providers/database';

import { users } from '@repo/db';
import { configs } from '@/config';
import * as os from 'node:os';
import { isRedisAvailable, getClient } from '@/providers/redis';
import { uploadStorage } from '@/providers/storage';
import { logger } from '@repo/logger';

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<'up' | 'down'> {
  try {
    await db.select().from(users).limit(1);
    return 'up';
  } catch (err) {
    logger.debug('Health check failed', { service: 'database', error: String(err) });
    return 'down';
  }
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<'up' | 'down'> {
  try {
    if (!isRedisAvailable()) {
      return 'down';
    }
    const client = getClient();
    if (!client) return 'down';
    await client.ping();
    return 'up';
  } catch (err) {
    logger.debug('Health check failed', { service: 'redis', error: String(err) });
    return 'down';
  }
}

/**
 * Check storage health
 */
export async function checkStorageHealth(): Promise<'up' | 'down'> {
  try {
    // Basic check if storage is initialized
    if (!uploadStorage) return 'down';
    
    // Upload storage in development usually uses local file system,
    // so we can just check if we can resolve a path
    uploadStorage.resolvePath('health-check-test');
    return 'up';
  } catch (err) {
    logger.debug('Health check failed', { service: 'storage', error: String(err) });
    return 'down';
  }
}

/**
 * Get system uptime in seconds
 */
export function getUptime(): number {
  return Math.floor(process.uptime());
}

/**
 * Get memory usage
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    used: usage.heapUsed,
    total: usage.heapTotal,
    percentage: (usage.heapUsed / usage.heapTotal) * 100
  };
}

/**
 * Get CPU usage (simplified)
 */
export function getCpuUsage() {
  const cpus = os.cpus();
  return {
    cores: cpus.length,
    usage: 0 // Placeholder - actual CPU usage requires more complex monitoring
  };
}

/**
 * Get system info
 */
export function getSystemInfo() {
  return {
    version: '1.0.0',
    environment: configs.APP.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: os.platform(),
    architecture: os.arch(),
    uptime: getUptime(),
    memory: getMemoryUsage(),
    cpu: getCpuUsage()
  };
}

/**
 * Determine overall health status
 */
export function determineHealthStatus(services: { database: string; redis: string; storage: string }): 'healthy' | 'degraded' | 'unhealthy' {
  const allUp = Object.values(services).every(status => status === 'up');
  const anyUp = Object.values(services).some(status => status === 'up');

  if (allUp) return 'healthy';
  if (anyUp) return 'degraded';
  return 'unhealthy';
}

