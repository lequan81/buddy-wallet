/**
 * Scheduled Jobs Utility
 * 
 * Runs maintenance tasks during low server load periods.
 * Uses a simple interval-based approach with load checking.
 */
import { db, importLogs, sessions, eq, and, lte } from '@repo/db';
import { log } from './logger';

// Track recent request count for load estimation
let recentRequestCount = 0;
const REQUEST_WINDOW_MS = 60000; // 1 minute window
const LOW_LOAD_THRESHOLD = 10; // Less than 10 requests/minute = low load

/**
 * Increment request counter (call from request middleware)
 */
export function trackRequest() {
  recentRequestCount++;
}

/**
 * Reset request counter periodically
 */
setInterval(() => {
  recentRequestCount = 0;
}, REQUEST_WINDOW_MS);

/**
 * Check if server is under low load
 */
function isLowLoad(): boolean {
  return recentRequestCount < LOW_LOAD_THRESHOLD;
}

/**
 * Cleanup stale pending import logs (older than 24 hours)
 * Only runs when server load is low
 */
async function cleanupStalePendingLogs() {
  if (!isLowLoad()) {
    log.debug('SCHEDULER', 'Skipping import cleanup - server under load');
    return;
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Delete pending logs older than 24 hours
    await db
      .delete(importLogs)
      .where(
        and(
          eq(importLogs.status, 'pending'),
          lte(importLogs.createdAt, oneDayAgo)
        )
      );

    log.info('SCHEDULER', 'Removed stale pending import logs (>24h)');
  } catch (err) {
    log.error('SCHEDULER', 'Failed to clean import logs', { error: String(err) });
  }
}

/**
 * Cleanup expired sessions (soft-deleted > 24h ago)
 * Only runs when server load is low
 */
async function cleanupExpiredSessions() {
  if (!isLowLoad()) {
    log.debug('SCHEDULER', 'Skipping sessions cleanup - server under load');
    return;
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Hard delete sessions that were revoked/logged_out more than 24 hours ago
    await db
      .delete(sessions)
      .where(
        and(
          // Only delete non-active sessions
          eq(sessions.status, 'revoked'),
          // That were revoked more than 24h ago
          lte(sessions.revokedAt, oneDayAgo)
        )
      );

    // Also delete logged_out sessions older than 24h
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.status, 'logged_out'),
          lte(sessions.revokedAt, oneDayAgo)
        )
      );

    // Delete expired sessions older than 24h
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.status, 'expired'),
          lte(sessions.refreshTokenExpiresAt, oneDayAgo)
        )
      );

    log.info('SCHEDULER', 'Removed expired/revoked sessions (>24h)');
  } catch (err) {
    log.error('SCHEDULER', 'Failed to clean sessions', { error: String(err) });
  }
}

/**
 * Start all scheduled cleanup jobs
 */
export function startCleanupJobs() {
  // Run cleanup every hour
  const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  log.info('SCHEDULER', 'Starting cleanup jobs (hourly, low-load only)');

  setInterval(async () => {
    await cleanupStalePendingLogs();
    await cleanupExpiredSessions();
  }, CLEANUP_INTERVAL_MS);

  // Also run once on startup after a delay (give server time to settle)
  setTimeout(async () => {
    await cleanupStalePendingLogs();
    await cleanupExpiredSessions();
  }, 30000); // 30 seconds after startup
}
