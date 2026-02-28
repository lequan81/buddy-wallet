/**
 * Device fingerprinting utilities
 * Parses user agent to extract device information for session management
 */
import type { Server } from 'bun';
import { logger } from '@repo/logger';
import type { DeviceInfo, ClientHints } from '../types/device';

// In-memory cache for IP/coordinate lookups (avoids redundant external calls)
const locationCache = new Map<string, { value: string; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Private IP ranges for RFC 1918
 */
const PRIVATE_IP_PATTERNS = [
  /^10\./, // 10.0.0.0/8
  /^192\.168\./, // 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[0-1])\./, // 172.16.0.0/12
  /^127\./, // Loopback
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 private
  /^fe80:/ // IPv6 link-local
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/**
 * Parse user agent string to extract device information
 * Supports client hints from modern browsers for more accurate detection
 */
export function parseUserAgent(userAgent: string | null, clientHints?: ClientHints): DeviceInfo {
  // Prefer client hints if provided (more accurate from navigator.userAgentData)
  if (clientHints?.browser && clientHints?.os) {
    return {
      deviceName: `${clientHints.browser} on ${clientHints.os}`,
      deviceType: clientHints.mobile ? 'mobile' : 'desktop',
      browser: clientHints.browser,
      os: clientHints.os
    };
  }

  // Fallback: parse userAgent string
  if (!userAgent) {
    return {
      deviceName: 'Web Browser',
      deviceType: 'desktop',
      browser: 'Unknown Browser',
      os: 'Unknown OS'
    };
  }

  const ua = userAgent.toLowerCase();

  // Data-driven OS detection
  const osPatterns = [
    { patterns: ['windows nt 10', 'windows nt 11'], name: 'Windows' },
    { patterns: ['windows'], name: 'Windows' },
    { patterns: ['macintosh', 'mac os x'], name: 'macOS' },
    { patterns: ['iphone'], name: 'iOS' },
    { patterns: ['ipad'], name: 'iPadOS' },
    { patterns: ['android'], name: 'Android' },
    { patterns: ['linux'], name: 'Linux', exclude: ['android'] },
    { patterns: ['cros'], name: 'Chrome OS' },
    { patterns: ['x11'], name: 'Unix' }
  ];

  const os = osPatterns.find(({ patterns, exclude }) => {
    const hasPattern = patterns.some(pattern => ua.includes(pattern));
    const hasExclusion = exclude?.some(pattern => ua.includes(pattern));
    return hasPattern && !hasExclusion;
  })?.name || 'Unknown OS';

  // Data-driven browser detection
  const browserPatterns = [
    { patterns: ['edg/', 'edge/'], name: 'Edge' },
    { patterns: ['opr/', 'opera'], name: 'Opera' },
    { patterns: ['firefox', 'fxios'], name: 'Firefox' },
    { patterns: ['crios'], name: 'Chrome' }, // Chrome on iOS
    { patterns: ['chrome'], name: 'Chrome', exclude: ['chromium', 'edg'] },
    { patterns: ['safari'], name: 'Safari', exclude: ['chrome', 'android'] },
    { patterns: ['msie', 'trident'], name: 'Internet Explorer' },
    { patterns: ['chromium'], name: 'Chromium' }
  ];

  const browser = browserPatterns.find(({ patterns, exclude }) => {
    const hasPattern = patterns.some(pattern => ua.includes(pattern));
    const hasExclusion = exclude?.some(pattern => ua.includes(pattern));
    return hasPattern && !hasExclusion;
  })?.name || 'Unknown Browser';

  // Detect Device Type
  let deviceType: DeviceInfo['deviceType'] = 'desktop';
  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    (ua.includes('android') && !ua.includes('tablet'))
  ) {
    deviceType = 'mobile';
  } else if (
    ua.includes('ipad') ||
    ua.includes('tablet') ||
    (ua.includes('android') && ua.includes('tablet'))
  ) {
    deviceType = 'tablet';
  }

  // Build device name with better fallback
  let deviceName: string;
  if (browser !== 'Unknown Browser' && os !== 'Unknown OS') {
    deviceName = `${browser} on ${os}`;
  } else if (browser !== 'Unknown Browser') {
    deviceName = browser;
  } else if (os !== 'Unknown OS') {
    deviceName = `Browser on ${os}`;
  } else {
    deviceName = 'Web Browser';
  }

  return {
    deviceName,
    deviceType,
    browser,
    os
  };
}

/**
 * Get public IP location using free API service
 */
async function getPublicIPLocation(ip: string): Promise<{ city: string; country: string } | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, {
      signal: AbortSignal.timeout(3000)
    });
    const data = await response.json();
    
    if (data.status === 'success' && data.country) {
      return {
        city: data.city || 'Unknown',
        country: data.country
      };
    }
  } catch (error: unknown) {
    logger.warn('[Device] Public IP geolocation failed', { ip, error: String(error) });
  }
  
  return null;
}

/**
 * Get location - prefer client-provided text location, fallback to IP lookup
 * Client location should already be reverse geocoded (e.g., "Ho Chi Minh City, Vietnam")
 */
export async function getLocationFromIP(
  ipAddress: string | null,
  clientLocation?: string | null,
  coordinates?: { lat: number; lon: number } | null
): Promise<string> {
  // 1. Client-provided text
  if (clientLocation && clientLocation.length > 2 && clientLocation !== 'Location unavailable') {
    return clientLocation;
  }

  // 2. Reverse geocode from coordinates (OpenStreetMap Nominatim - free)
  if (coordinates?.lat && coordinates?.lon) {
    const coordKey = `geo:${coordinates.lat.toFixed(2)},${coordinates.lon.toFixed(2)}`;
    const cached = locationCache.get(coordKey);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coordinates.lat}&lon=${coordinates.lon}&format=json&zoom=10`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'BuddyWallet/1.0' }
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.address) {
          const city = data.address.city || data.address.town || data.address.village;
          const country = data.address.country;
          if (city && country) {
            const result = `${city}, ${country}`;
            locationCache.set(coordKey, { value: result, expires: Date.now() + CACHE_TTL });
            return result;
          }
          if (country) {
            locationCache.set(coordKey, { value: country, expires: Date.now() + CACHE_TTL });
            return country;
          }
        }
      }
    } catch {
      logger.warn('[Device] Nominatim reverse geocode failed');
    }
  }

  // Clean IP for further checks
  const cleanIP = ipAddress ? ipAddress.replace('::ffff:', '') : null;

  // Handle missing IP after client-provided and coordinates checks
  if (!cleanIP) {
    return 'Unknown Location';
  }

  // Check for localhost
  if (isLocalhost(cleanIP)) {
    return 'Unknown Location';
  }

  // Check for private network
  if (isPrivateIP(cleanIP)) {
    return 'Unknown Location';
  }

  // 3. Try public IP geolocation first (more accurate for public IPs)
  const ipCacheKey = `ip:${cleanIP}`;
  const cachedIP = locationCache.get(ipCacheKey);
  if (cachedIP && cachedIP.expires > Date.now()) return cachedIP.value;

  try {
    const publicLocation = await getPublicIPLocation(cleanIP);
    if (publicLocation) {
      const result = publicLocation.city !== 'Unknown' 
        ? `${publicLocation.city}, ${publicLocation.country}`
        : publicLocation.country;
      locationCache.set(ipCacheKey, { value: result, expires: Date.now() + CACHE_TTL });
      return result;
    }
  } catch {
    logger.warn('[Device] Public IP geolocation failed', { ip: cleanIP });
  }

  // If all geolocation attempts fail, return Unknown Location
  return 'Unknown Location';
}

/**
 * Extract client IP from request headers
 * Handles various proxy headers
 */
export function getClientIP(request: Request, server?: Server<unknown> | null): string | null {
  // Check common proxy headers (in order of preference)
  const headers = [
    'cf-connecting-ip', // Cloudflare (most reliable for public IP)
    'x-real-ip', // Nginx
    'x-forwarded-for', // Standard proxy header
    'x-client-ip', // Apache
    'true-client-ip' // Akamai
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // Get the first IP in the chain (original client)
      const ip = value.split(',')[0].trim();
      if (ip && !isPrivateIP(ip)) {
        return ip; // Return public IP immediately
      }
    }
  }

  // Fallback to socket IP if server instance is passed
  if (server?.requestIP) {
    const socketIP = server.requestIP(request)?.address;
    if (socketIP && !isPrivateIP(socketIP)) {
      return socketIP;
    }
  }

  // If no public IP found, check for private IPs (for local development)
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  if (server?.requestIP) {
    const socketIP = server.requestIP(request)?.address;
    if (socketIP) return socketIP;
  }

  return null;
}

// Re-export ClientHints type for use in other modules
export type { ClientHints };
