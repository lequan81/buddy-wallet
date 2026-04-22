/**
 * Trace/OpenTelemetry Type Definitions
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

export interface TraceStats {
  total: number;
  errors: number;
  avgDuration: string;
}

export interface TraceStore {
  add(span: TraceSpan): void;
  getAll(): TraceSpan[];
  getByTraceId(traceId: string): TraceSpan[];
  clear(): void;
  stats(): TraceStats;
}

