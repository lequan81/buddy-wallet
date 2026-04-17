/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for gradual rollouts,
 * A/B testing, and safe migration patterns.
 * 
 * All flags are read from environment variables with sensible defaults.
 * Use env.bool() for boolean flags, env.string() for string flags.
 * 
 * @example
 * import { FEATURE_FLAGS } from '@repo/config';
 * if (FEATURE_FLAGS.USE_NEW_CONTROLLERS) { ... }
 */

import { env } from '../env';

/**
 * Feature flags interface for type safety
 */
export interface FeatureFlags {
  /** Use new app/Http/Controllers structure instead of legacy controllers */
  USE_NEW_CONTROLLERS: boolean;
  /** Enable detailed request/response tracing for debugging */
  ENABLE_DETAILED_TRACING: boolean;
  /** Enable experimental import batching optimizations */
  ENABLE_IMPORT_BATCHING_V2: boolean;
  /** Enable new notification service architecture */
  ENABLE_NEW_NOTIFICATIONS: boolean;
}

/**
 * Active feature flags - read from environment with defaults
 * 
 * Note: In production, all new features should default to false
 * until explicitly enabled via environment variables.
 */
export const FEATURE_FLAGS: FeatureFlags = {
  // Migration flags - default false for safety
  USE_NEW_CONTROLLERS: env.bool('USE_NEW_CONTROLLERS', false),
  
  // Debug/observability flags
  ENABLE_DETAILED_TRACING: env.bool('ENABLE_DETAILED_TRACING', false),
  
  // Feature enhancement flags
  ENABLE_IMPORT_BATCHING_V2: env.bool('ENABLE_IMPORT_BATCHING_V2', false),
  ENABLE_NEW_NOTIFICATIONS: env.bool('ENABLE_NEW_NOTIFICATIONS', false),
} as const;

/**
 * Check if a specific feature flag is enabled
 * 
 * @param flag - The feature flag to check
 * @returns boolean indicating if the flag is enabled
 * 
 * @example
 * import { isEnabled } from '@repo/config';
 * if (isEnabled('USE_NEW_CONTROLLERS')) { ... }
 */
export function isEnabled(flag: keyof FeatureFlags): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Require a feature flag to be enabled, throwing if disabled
 * 
 * @param flag - The feature flag to check
 * @param context - Optional context message for the error
 * @throws Error if the feature flag is disabled
 * 
 * @example
 * import { requireFlag } from '@repo/config';
 * requireFlag('USE_NEW_CONTROLLERS', 'New auth flow');
 */
export function requireFlag(flag: keyof FeatureFlags, context?: string): void {
  if (!FEATURE_FLAGS[flag]) {
    const message = context 
      ? `Feature flag '${flag}' must be enabled for: ${context}`
      : `Feature flag '${flag}' is required but disabled`;
    throw new Error(message);
  }
}

/**
 * Log current feature flag status for debugging
 * Use this during application startup to verify configuration
 */
export function logFeatureFlags(): void {
  const entries = Object.entries(FEATURE_FLAGS);
  const enabled = entries.filter(([, v]) => v).map(([k]) => k);
  const disabled = entries.filter(([, v]) => !v).map(([k]) => k);
  
  console.log('[FeatureFlags] Configuration:');
  console.log(`  Enabled (${enabled.length}): ${enabled.join(', ') || 'none'}`);
  console.log(`  Disabled (${disabled.length}): ${disabled.join(', ') || 'none'}`);
}
