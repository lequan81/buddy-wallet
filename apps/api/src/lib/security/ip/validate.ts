/**
 * IP validation utilities for security purposes
 */

// IPv4 private ranges
const PRIVATE_IPV4_RANGES = [
  /^10\./,                              // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,    // 172.16.0.0/12
  /^192\.168\./,                       // 192.168.0.0/16
  /^127\./,                             // 127.0.0.0/8 (loopback)
  /^169\.254\./,                       // 169.254.0.0/16 (link-local)
  /^0\./,                               // 0.0.0.0/8
];

// IPv6 private ranges (simplified)
const PRIVATE_IPV6_PATTERNS = [
  /^fc00:/i,    // Unique local addresses (fc00::/7)
  /^fd00:/i,    // Unique local addresses (fd00::/8)
  /^fe80:/i,    // Link-local (fe80::/10)
  /^::1$/i,     // Loopback
  /^::$/i,      // Unspecified
];

/**
 * Check if an IP address is private/internal
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4
  if (ip.includes('.')) {
    return PRIVATE_IPV4_RANGES.some(pattern => pattern.test(ip));
  }

  // IPv6
  return PRIVATE_IPV6_PATTERNS.some(pattern => pattern.test(ip));
}

/**
 * Check if IP is a loopback address
 */
export function isLoopback(ip: string): boolean {
  return ip === '127.0.0.1' ||
         ip === '::1' ||
         ip.startsWith('127.');
}

/**
 * List of known cloud provider/trusted proxy IPs
 * These should be updated based on your infrastructure
 */
const TRUSTED_PROXIES = new Set([
  // Cloudflare
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
]);

/**
 * Check if IP is from a trusted proxy
 * NOTE: This is a simplified check. For production, use a proper CIDR library
 */
export function isTrustedProxy(ip: string): boolean {
  // For now, check if it's a private IP (common for internal proxies)
  if (isPrivateIP(ip)) return true;

  // TODO: Implement proper CIDR matching for cloud provider ranges
  // This would require a library like 'ip-address' or 'cidr-tools'

  return false;
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  // IPv4 validation
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
    });
  }

  // IPv6 validation (simplified)
  if (ip.includes(':')) {
    // Basic check - full IPv6 validation is complex
    return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes('::') ? true : ip.split(':').length <= 8;
  }

  return false;
}
