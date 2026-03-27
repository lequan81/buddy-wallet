/**
 * Device and location related type definitions
 * Shared between API and Web
 */

/** Geographic coordinates (lat/lon) */
export interface Coordinates {
  lat: number;
  lon: number;
}

/** Base location info (city/region/country) */
export interface LocationBase {
  city: string;
  country: string;
  region?: string;
}

/** Location with timezone */
export interface LocationWithTimezone extends LocationBase {
  timezone?: string;
}

/** Device info from user agent */
export interface DeviceInfo {
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
}

/** Client hints from navigator.userAgentData */
export interface ClientHints {
  browser?: string;
  os?: string;
  mobile?: boolean;
  brands?: Array<{ brand: string; version: string }>;
  platform?: string;
}

/** Client location - alias for LocationWithTimezone */
export type ClientLocation = LocationWithTimezone;

/** Full location with coordinates */
export type LocationResult = LocationWithTimezone & Coordinates;

/** IP Geolocation API response */
export interface IPLocationResponse extends Coordinates, LocationWithTimezone {
  status: string;
  countryCode: string;
  regionName: string;
  zip: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}
