/**
 * Device fingerprinting utilities
 * Parses user agent to extract device information for session management
 */

interface DeviceInfo {
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
}

/**
 * Parse user agent string to extract device information
 * This is a lightweight implementation - for production, consider using ua-parser-js
 */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return {
      deviceName: 'Unknown Device',
      deviceType: 'unknown',
      browser: 'Unknown',
      os: 'Unknown'
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows nt 10') || ua.includes('windows nt 11')) os = 'Windows';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('iphone')) os = 'iOS';
  else if (ua.includes('ipad')) os = 'iPadOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('cros')) os = 'Chrome OS';

  // Detect Browser
  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';
  else if (ua.includes('msie') || ua.includes('trident')) browser = 'Internet Explorer';

  // Detect Device Type
  let deviceType: DeviceInfo['deviceType'] = 'desktop';
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    deviceType = 'mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    deviceType = 'tablet';
  }

  // Build device name
  const deviceName = `${browser} on ${os}`;

  return {
    deviceName,
    deviceType,
    browser,
    os
  };
}

/**
 * Get approximate location from IP address
 * In production, use a proper IP geolocation service like:
 * - ipinfo.io
 * - ip-api.com
 * - MaxMind GeoIP
 */
export async function getLocationFromIP(ipAddress: string | null): Promise<string | null> {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
    return 'Local';
  }

  // Remove IPv6 prefix if present
  const cleanIP = ipAddress.replace('::ffff:', '');

  // Skip private IP ranges
  if (
    cleanIP.startsWith('10.') ||
    cleanIP.startsWith('192.168.') ||
    cleanIP.startsWith('172.16.') ||
    cleanIP.startsWith('172.17.') ||
    cleanIP.startsWith('172.18.') ||
    cleanIP.startsWith('172.19.') ||
    cleanIP.startsWith('172.2') ||
    cleanIP.startsWith('172.30.') ||
    cleanIP.startsWith('172.31.')
  ) {
    return 'Private Network';
  }

  try {
    // Use free IP geolocation API (rate limited, for dev/small scale)
    // For production, use a paid service with API key
    const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=city,country`);
    if (response.ok) {
      const data = await response.json();
      if (data.city && data.country) {
        return `${data.city}, ${data.country}`;
      }
      if (data.country) {
        return data.country;
      }
    }
  } catch (error) {
    console.warn('[Device] Failed to get location from IP:', error);
  }

  return null;
}

/**
 * Extract client IP from request headers
 * Handles various proxy headers
 */
export function getClientIP(request: Request): string | null {
  // Check common proxy headers (in order of preference)
  const headers = [
    'cf-connecting-ip', // Cloudflare
    'x-real-ip', // Nginx
    'x-forwarded-for', // Standard proxy header
    'x-client-ip', // Apache
    'true-client-ip' // Akamai
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return null;
}
