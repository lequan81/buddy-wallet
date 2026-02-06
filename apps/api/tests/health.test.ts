import { describe, expect, it, test } from 'bun:test';
import { app } from '../src';

describe('Health Check', () => {
  test('GET /health should return 200 OK', async () => {
    const response = await app.handle(new Request('http://localhost/health'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('uptime');
  });
});
