/**
 * In-Memory Trace Store for Local Development
 * Stores recent traces for viewing at /traces
 */

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  method?: string;
  path?: string;
  status?: number;
  duration: number; // ms
  timestamp: Date;
  error?: string;
  attributes: Record<string, unknown>;
}

const MAX_TRACES = 100;
const traces: TraceSpan[] = [];

export const traceStore = {
  add(span: TraceSpan) {
    traces.unshift(span); // Add to front (newest first)
    if (traces.length > MAX_TRACES) {
      traces.pop(); // Remove oldest
    }
  },

  getAll(): TraceSpan[] {
    return traces;
  },

  getByTraceId(traceId: string): TraceSpan[] {
    return traces.filter(t => t.traceId === traceId);
  },

  clear() {
    traces.length = 0;
  },

  stats() {
    const total = traces.length;
    const errors = traces.filter(t => t.status && t.status >= 400).length;
    const avgDuration = total > 0
      ? traces.reduce((sum, t) => sum + t.duration, 0) / total
      : 0;
    return { total, errors, avgDuration: avgDuration.toFixed(2) };
  }
};
