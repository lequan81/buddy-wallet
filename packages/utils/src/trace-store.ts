/**
 * Trace Store
 * Simple in-memory store for OpenTelemetry trace context
 * Maintains tracing context across async operations
 */

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  flags: string;
  state?: string;
}

class TraceStore {
  private store = new Map<string, TraceContext>();
  private contextKey = 'trace_context';

  /**
   * Set trace context for current request
   */
  set(traceContext: TraceContext): void {
    const key = this.contextKey;
    this.store.set(key, traceContext);
  }

  /**
   * Get trace context for current request
   */
  get(): TraceContext | undefined {
    return this.store.get(this.contextKey);
  }

  /**
   * Clear trace context
   */
  clear(): void {
    this.store.delete(this.contextKey);
  }

  /**
   * Generate new trace ID
   */
  static generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate new span ID
   */
  static generateSpanId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Create new trace context
   */
  static createContext(parentContext?: TraceContext): TraceContext {
    return {
      traceId: parentContext?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: parentContext?.spanId,
      flags: parentContext?.flags || '01',
      state: parentContext?.state
    };
  }
}

export const traceStore = new TraceStore();
export type { TraceContext };
