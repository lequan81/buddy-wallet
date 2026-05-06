import { describe, expect, test } from 'bun:test';
import { telemetry } from '@/providers/telemetry';

describe('Telemetry Provider', () => {
  test('telemetry export is defined (plugin or null-safe)', () => {
    expect(telemetry !== undefined).toBe(true);
  });
});
