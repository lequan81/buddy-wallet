import { describe, expect, it, test, beforeAll, afterAll } from 'bun:test';
import { app } from '../src';
import { traceStore } from '@utils/trace-store';
import { trace } from '@opentelemetry/api';

describe('OpenTelemetry Integration', () => {
  beforeAll(() => {
    // Clear existing traces to ensure clean state
    traceStore.clear();
  });

  test('should capture request traces', async () => {
    // 1. Make a request to the app
    const response = await app.handle(new Request('http://localhost/health'));
    expect(response.status).toBe(200);

    // 2. Wait a moment for async processing (exporters might be async)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Verify traceStore has the trace
    const traces = traceStore.getAll();
    // console.log('Current traces:', JSON.stringify(traces, null, 2));
    expect(traces.length).toBeGreaterThan(0);
  });
});
