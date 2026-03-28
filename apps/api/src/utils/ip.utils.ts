/**
 * IP related utilities
 * Handles client IP extraction and proxy validation
 */
import type { Server } from 'bun';

/**
 * Trusted proxy IP ranges (configured via environment)
 * Only these proxies can set X-Forwarded-For header
 */
const TRUSTED_PROXIES = new Set<string>(
  (process.env.TRUSTED_PROXIES || '127.0.0.1,::1')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

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

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

export function isLocalhost(ip: string): boolean {
  const cleanIP = ip.replace('::ffff:', '');
  return cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP === 'localhost';
}

/**
 * Check if IP address is from a trusted proxy
 */
export function isTrustedProxy(ip: string | null): boolean {
  if (!ip) return false;
  const cleanIP = ip.replace('::ffff:', '');

  // Check exact match
  if (TRUSTED_PROXIES.has(cleanIP)) return true;

  // Check if it's a local IP (always trusted)
  if (isLocalhost(cleanIP)) return true;

  // Check if it's in private IP ranges
  if (isPrivateIP(cleanIP)) return true;

  return false;
}

/**
 * Extract client IP from request headers
 * Handles various proxy headers with security validation
 */
export function getClientIP(request: Request, server?: Server<unknown> | null): string | null {
  // Check common proxy headers (in order of preference)
  const headers = [
    'cf-connecting-ip', // Cloudflare
    'x-real-ip', // Nginx
    'x-forwarded-for', // Standard proxy header
    'x-client-ip', // Apache
    'true-client-ip' // Akamai
  ];

  // For security, only trust X-Forwarded-For if it comes from a trusted proxy
  // This logic is simplified for now but provides a foundation
  const realIP = request.headers.get('x-real-ip');

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      
      // If it's X-Forwarded-For, check proxy trust
      if (header === 'x-forwarded-for' && !isTrustedProxy(realIP)) {
        continue; // Skip untrusted forwarded header
      }

      if (ip && !isPrivateIP(ip)) {
        return ip; // Return public IP
      }
    }
  }

  // Fallback to socket IP
  if (server?.requestIP) {
    const socketIP = server.requestIP(request)?.address;
    if (socketIP && !isPrivateIP(socketIP)) {
      return socketIP;
    }
  }

  // Final fallback (including private IPs for development)
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  if (server?.requestIP) {
    return server.requestIP(request)?.address || null;
  }

  return null;
}
