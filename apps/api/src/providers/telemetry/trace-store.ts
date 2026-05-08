/**
 * In-Memory Trace Store for Development
 *
 * Stores traces in memory for the /traces UI.
 * This is only used in development mode.
 */

export interface TraceSpan {
  id: string;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: 'pending' | 'completed' | 'error';
  metadata?: Record<string, unknown>;
  error?: string;
  method?: string;
  path?: string;
  timestamp?: Date;
  attributes?: Record<string, unknown>;
}

class TraceStore {
  private spans: TraceSpan[] = [];
  private maxSize = 1000;

  add(span: TraceSpan): void {
    this.spans.push(span);
    // Keep only last N spans to prevent memory bloat
    if (this.spans.length > this.maxSize) {
      this.spans = this.spans.slice(-this.maxSize);
    }
  }

  getAll(): TraceSpan[] {
    return [...this.spans];
  }

  getByTraceId(traceId: string): TraceSpan[] {
    return this.spans.filter(s => s.traceId === traceId);
  }

  clear(): void {
    this.spans = [];
  }

  stats() {
    const total = this.spans.length;
    const errors = this.spans.filter((s) => s.status === 'error').length;
    const avgDuration =
      total > 0
        ? (this.spans.reduce((acc, s) => acc + (s.duration || 0), 0) / total).toFixed(1)
        : '0.0';

    return { total, errors, avgDuration };
  }
}

export const traceStore = new TraceStore();
