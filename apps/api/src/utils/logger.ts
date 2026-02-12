/**
 * Structured Logger for Buddy Wallet API
 * - Dev: Pretty print with colors
 * - Prod: JSON format for log aggregators
 * - Minimal footprint using Bun native APIs
 *
 * Environment variables:
 * - LOG_LEVEL: Set log level ('debug', 'info', 'warn', 'error') - default: 'info'
 */

import type { LogLevel, LogContext as LogContextType } from '../types';

// Re-export for consumers
export type LogContext = LogContextType;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = (Bun.env.LOG_LEVEL?.toLocaleLowerCase() as LogLevel) || 'info';
const isDev = Bun.env.NODE_ENV !== 'production';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(
  level: LogLevel,
  category: string,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();

  if (isDev) {
    // Pretty print for development
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m', // green
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m' // red
    };
    const reset = '\x1b[0m';
    const color = levelColors[level];
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${color}[${level.toUpperCase()}]${reset} [${category}] ${message}${ctx}`;
  }

  // JSON for production (easy to parse by log aggregators)
  return JSON.stringify({
    timestamp,
    level,
    category,
    message,
    ...context
  });
}

export const log = {
  debug: (category: string, message: string, context?: LogContext) => {
    if (shouldLog('debug')) console.debug(formatLog('debug', category, message, context));
  },
  info: (category: string, message: string, context?: LogContext) => {
    if (shouldLog('info')) console.info(formatLog('info', category, message, context));
  },
  warn: (category: string, message: string, context?: LogContext) => {
    if (shouldLog('warn')) console.warn(formatLog('warn', category, message, context));
  },
  error: (category: string, message: string, context?: LogContext) => {
    if (shouldLog('error')) console.error(formatLog('error', category, message, context));
  }
};

// Convenience aliases for categories
export const logger = {
  // Verbose logs (debug level - dev only by default)
  jwt: (msg: string, ctx?: LogContext) => log.debug('JWT', msg, ctx),
  cors: (msg: string, ctx?: LogContext) => log.debug('CORS', msg, ctx),
  db: (msg: string, ctx?: LogContext) => log.debug('DB', msg, ctx),
  permission: (msg: string, ctx?: LogContext) => log.debug('PERMISSION', msg, ctx),

  // Info level logs
  auth: (msg: string, ctx?: LogContext) => log.info('AUTH', msg, ctx),
  http: (msg: string, ctx?: LogContext) => log.info('HTTP', msg, ctx),
  app: (msg: string, ctx?: LogContext) => log.info('APP', msg, ctx),
  push: (msg: string, ctx?: LogContext) => log.info('PUSH', msg, ctx),

  // Security-critical logs (warn level - always visible)
  csrf: (msg: string, ctx?: LogContext) => log.warn('CSRF', msg, ctx),
  rateLimit: (msg: string, ctx?: LogContext) => log.warn('RATE_LIMIT', msg, ctx),
  accessControl: (msg: string, ctx?: LogContext) => log.warn('ACCESS_CONTROL', msg, ctx),
  security: (msg: string, ctx?: LogContext) => log.warn('SECURITY', msg, ctx),

  // Trace level (OpenTelemetry spans - debug level)
  trace: (msg: string, ctx?: LogContext) => log.debug('TRACE', msg, ctx),

  // Error level
  error: (msg: string, ctx?: LogContext) => log.error('ERROR', msg, ctx),

  // Generic log level methods (for flexibility)
  warn: (msg: string, ctx?: LogContext) => log.warn('WARN', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log.info('INFO', msg, ctx),
  debug: (msg: string, ctx?: LogContext) => log.debug('DEBUG', msg, ctx)
};
