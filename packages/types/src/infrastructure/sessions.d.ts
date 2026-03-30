import type { Session as DBSession } from '@repo/db';

/**
 * Session & Device Types
 */
export interface ClientHints {
  platform?: string;
  mobile?: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ClientLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  coordinates?: Coordinates | null;
  timezone?: string | null;
}

export interface SessionInfo extends DBSession {
  isCurrent?: boolean;
}
