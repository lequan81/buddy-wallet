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
 * Client hints from navigator.userAgentData (sent from frontend)
 */
interface ClientHints {
  browser?: string;
  os?: string;
  mobile?: boolean;
}

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
      deviceType: 'unknown',
      browser: 'Browser',
      os: 'Unknown OS'
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('windows nt 10') || ua.includes('windows nt 11')) os = 'Windows';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('iphone')) os = 'iOS';
  else if (ua.includes('ipad')) os = 'iPadOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('cros')) os = 'Chrome OS';

  // Detect Browser
  let browser = 'Browser';
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
 * Get location - prefer client-provided text location, fallback to IP lookup
 * Client location should already be reverse geocoded (e.g., "Ho Chi Minh City, Vietnam")
 */
export async function getLocationFromIP(
  ipAddress: string | null,
  clientLocation?: string | null
): Promise<string> {
  // 1. Use client-provided text location if valid (already privacy-safe)
  if (clientLocation && clientLocation.length > 2 && clientLocation !== 'Location unavailable') {
    return clientLocation;
  }

  // 2. Handle missing IP
  if (!ipAddress) {
    return 'Unknown Location';
  }

  // Remove IPv6 prefix if present
  const cleanIP = ipAddress.replace('::ffff:', '');

  // 3. Check for localhost
  if (isLocalhost(cleanIP)) {
    return 'Local Development';
  }

  // 4. Check for private network (cleaner than long if-chain)
  if (isPrivateIP(cleanIP)) {
    return 'Private Network';
  }

  // 5. Try IP geolocation as last resort
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=city,country,status`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        if (data.city && data.country) return `${data.city}, ${data.country}`;
        if (data.country) return data.country;
      }
    }
  } catch {
    console.warn('[Device] IP geolocation failed:', cleanIP);
  }

  // 6. Final fallback - show partial IP
  return `IP: ${cleanIP.substring(0, 8)}...`;
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

// Re-export ClientHints type for use in other modules
export type { ClientHints };
