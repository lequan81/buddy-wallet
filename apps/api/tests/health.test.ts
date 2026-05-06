import { describe, expect, test } from 'bun:test';
import { determineHealthStatus, getSystemInfo } from '@/modules/system/services/system.service';

describe('System Health Service', () => {
  test('determineHealthStatus returns healthy when all services are up', () => {
    const status = determineHealthStatus({ database: 'up', redis: 'up', storage: 'up' });
    expect(status).toBe('healthy');
  });

  test('determineHealthStatus returns degraded when at least one service is up', () => {
    const status = determineHealthStatus({ database: 'up', redis: 'down', storage: 'down' });
    expect(status).toBe('degraded');
  });

  test('determineHealthStatus returns unhealthy when all services are down', () => {
    const status = determineHealthStatus({ database: 'down', redis: 'down', storage: 'down' });
    expect(status).toBe('unhealthy');
  });

  test('getSystemInfo includes expected keys', () => {
    const info = getSystemInfo();
    expect(typeof info.version).toBe('string');
    expect(typeof info.environment).toBe('string');
    expect(typeof info.uptime).toBe('number');
    expect(typeof info.memory.used).toBe('number');
  });
});
