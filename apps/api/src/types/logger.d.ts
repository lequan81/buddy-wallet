/**
 * Logger Type Definitions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug: (category: string, message: string, context?: LogContext) => void;
  info: (category: string, message: string, context?: LogContext) => void;
  warn: (category: string, message: string, context?: LogContext) => void;
  error: (category: string, message: string, context?: LogContext) => void;
}
