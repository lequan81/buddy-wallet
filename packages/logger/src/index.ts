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

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = (process.env.LOG_LEVEL?.toLocaleLowerCase() as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format log message for consistent output
 */
export function formatLog(
  level: LogLevel,
  category: string,
  message: string,
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${contextStr}`;
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
