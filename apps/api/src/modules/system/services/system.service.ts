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

import { UserRepository } from '@/repositories/user/user.repo';
import { configs } from '@/config';
import * as os from 'node:os';
import { isRedisAvailable, getClient } from '@/providers/redis';
import { uploadStorage, isS3Available } from '@/providers/storage';
import { logger } from '@repo/logger';

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<'up' | 'down'> {
  try {
    const userRepo = new UserRepository(db);
    await userRepo.findMany(1, 0);
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

let cachedS3Status: 'up' | 'down' = 'up';
let isCheckingS3 = false;
let lastS3CheckTime = 0;
const S3_CACHE_TTL_MS = 15000; // Cache health check for 15 seconds

/**
 * Check storage health (uses non-blocking background refresh to decouple latency)
 */
export async function checkStorageHealth(): Promise<'up' | 'down'> {
  if (!uploadStorage) return 'down';

  const now = Date.now();
  
  // If cache is expired and no check is currently running, trigger a background refresh
  if (now - lastS3CheckTime > S3_CACHE_TTL_MS && !isCheckingS3) {
    isCheckingS3 = true;
    
    isS3Available()
      .then((healthy) => {
        cachedS3Status = healthy ? 'up' : 'down';
        lastS3CheckTime = Date.now();
      })
      .catch((err) => {
        logger.debug('Background S3 health check failed', { error: String(err) });
        cachedS3Status = 'down';
      })
      .finally(() => {
        isCheckingS3 = false;
      });
  }

  // Return the cached status immediately (zero HTTP response latency)
  return cachedS3Status;
}

/**
 * Get system uptime in seconds
 */
export function getUptime(): number {
  return Math.floor(process.uptime());
}

let lastCpuUsage = process.cpuUsage();
let lastCpuTime = process.hrtime();

/**
 * Get memory usage
 */
export function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    used,
    total,
    usedMB: parseFloat((used / 1024 / 1024).toFixed(2)),
    totalMB: parseFloat((total / 1024 / 1024).toFixed(2)),
    percentage: parseFloat(((used / total) * 100).toFixed(2))
  };
}

/**
 * Get CPU usage using process usage and hrtime deltas
 */
export function getCpuUsage() {
  const cpus = os.cpus();
  const currentUsage = process.cpuUsage();
  const currentTime = process.hrtime();

  const userDelta = currentUsage.user - lastCpuUsage.user;
  const systemDelta = currentUsage.system - lastCpuUsage.system;
  const totalCpuUsage = userDelta + systemDelta;

  const timeDeltaSec = (currentTime[0] - lastCpuTime[0]) + (currentTime[1] - lastCpuTime[1]) / 1e9;
  const timeDeltaMicro = timeDeltaSec * 1e6;

  let usagePercent = 0;
  if (timeDeltaMicro > 0) {
    usagePercent = parseFloat(((totalCpuUsage / timeDeltaMicro) * 100 / cpus.length).toFixed(2));
  }

  // Update last values
  lastCpuUsage = currentUsage;
  lastCpuTime = currentTime;

  if (usagePercent > 100) usagePercent = 100;
  if (usagePercent < 0 || Number.isNaN(usagePercent)) usagePercent = 0;

  return {
    cores: cpus.length,
    usage: usagePercent
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

