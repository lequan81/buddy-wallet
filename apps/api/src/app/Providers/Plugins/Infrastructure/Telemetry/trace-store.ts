/**
 * In-Memory Trace Store for Development
 *
 * Stores traces in memory for the /traces UI.
 * This is only used in development mode.
 */
import type { TraceSpan } from '@/types/trace';

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
    const errors = this.spans.filter((s) => s.status && s.status >= 400).length;
    const avgDuration =
      total > 0
        ? (this.spans.reduce((acc, s) => acc + s.duration, 0) / total).toFixed(1)
        : '0.0';

    return { total, errors, avgDuration };
  }
}

export const traceStore = new TraceStore();
