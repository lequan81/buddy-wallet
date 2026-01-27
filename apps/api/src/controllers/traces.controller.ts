/**
 * Trace Viewer Controller
 * Provides a simple UI to view recent traces at /traces
 * Only available in development mode
 */

import { Elysia } from 'elysia';
import { traceStore } from '../utils/trace-store';

const isDev = Bun.env.NODE_ENV !== 'production';

// Simple HTML UI for trace viewing
const traceViewerHTML = () => {
  const traces = traceStore.getAll();
  const stats = traceStore.stats();

  const traceRows = traces.map(t => {
    const statusClass = t.status && t.status >= 400 ? 'error' : 'success';
    const method = t.method || 'SPAN';
    const path = t.path || t.name;
    return `
      <tr class="${statusClass}">
        <td class="time">${t.timestamp.toISOString().slice(11, 23)}</td>
        <td class="method">${method}</td>
        <td class="path">${path}</td>
        <td class="status">${t.status || '-'}</td>
        <td class="duration">${t.duration.toFixed(1)}ms</td>
        <td class="trace-id" title="${t.traceId}">${t.traceId.slice(0, 8)}...</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Traces - Buddy Wallet API</title>
  <meta http-equiv="refresh" content="5">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #0d1117; 
      color: #c9d1d9; 
      padding: 20px;
    }
    h1 { color: #58a6ff; margin-bottom: 10px; }
    .stats { 
      display: flex; 
      gap: 20px; 
      margin-bottom: 20px;
      padding: 15px;
      background: #161b22;
      border-radius: 8px;
    }
    .stat { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #58a6ff; }
    .stat-label { font-size: 12px; color: #8b949e; }
    .controls { margin-bottom: 15px; }
    .btn {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      margin-right: 10px;
    }
    .btn:hover { background: #30363d; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      background: #161b22;
      border-radius: 8px;
      overflow: hidden;
    }
    th { 
      background: #21262d; 
      padding: 12px; 
      text-align: left; 
      font-size: 12px;
      text-transform: uppercase;
      color: #8b949e;
    }
    td { padding: 10px 12px; border-bottom: 1px solid #21262d; }
    tr:hover { background: #1f2428; }
    tr.error { background: rgba(248, 81, 73, 0.1); }
    tr.error .status { color: #f85149; }
    tr.success .status { color: #3fb950; }
    .method { 
      font-weight: bold;
      color: #d2a8ff;
    }
    .path { color: #79c0ff; }
    .duration { color: #ffa657; }
    .trace-id { 
      font-family: monospace; 
      font-size: 11px;
      color: #8b949e;
    }
    .time { color: #8b949e; font-size: 12px; }
    .empty { 
      text-align: center; 
      padding: 40px; 
      color: #8b949e;
    }
    .auto-refresh { font-size: 12px; color: #8b949e; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>🔍 Trace Viewer</h1>
  <p style="color: #8b949e; margin-bottom: 20px;">Buddy Wallet API - Development Mode</p>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${stats.total}</div>
      <div class="stat-label">Total Requests</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: ${stats.errors > 0 ? '#f85149' : '#3fb950'}">${stats.errors}</div>
      <div class="stat-label">Errors</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats.avgDuration}ms</div>
      <div class="stat-label">Avg Duration</div>
    </div>
  </div>

  <div class="controls">
    <button class="btn" onclick="fetch('/traces/clear', {method:'POST'}).then(()=>location.reload())">Clear Traces</button>
    <button class="btn" onclick="location.reload()">Refresh</button>
  </div>

  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Method</th>
        <th>Path</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Trace ID</th>
      </tr>
    </thead>
    <tbody>
      ${traceRows || '<tr><td colspan="6" class="empty">No traces yet. Make some requests!</td></tr>'}
    </tbody>
  </table>
  
  <p class="auto-refresh">Auto-refreshes every 5 seconds</p>
</body>
</html>`;
};

export const tracesController = new Elysia({ name: 'TracesController' })
  .get('/traces', () => {
    if (!isDev) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(traceViewerHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  })
  .get('/traces/json', () => {
    if (!isDev) {
      return { error: 'Not available in production' };
    }
    return {
      stats: traceStore.stats(),
      traces: traceStore.getAll()
    };
  })
  .post('/traces/clear', () => {
    if (!isDev) {
      return { error: 'Not available in production' };
    }
    traceStore.clear();
    return { success: true, message: 'Traces cleared' };
  });
