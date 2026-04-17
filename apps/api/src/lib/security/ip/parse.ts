/**
 * IP address parsing and normalization utilities
 */

/**
 * Normalize IP address for consistent storage/comparison
 */
export function normalizeIP(ip: string): string | null {
  if (!ip) return null;

  const trimmed = ip.trim().toLowerCase();

  // IPv4
  if (trimmed.includes('.')) {
    return normalizeIPv4(trimmed);
  }

  // IPv6
  if (trimmed.includes(':')) {
    return normalizeIPv6(trimmed);
  }

  return null;
}

/**
 * Normalize IPv4 address
 * Removes leading zeros and validates format
 */
function normalizeIPv4(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  const normalized = parts.map(part => {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    return num.toString();
  });

  if (normalized.some(p => p === null)) return null;
  return normalized.join('.');
}

/**
 * Normalize IPv6 address
 * Returns full compressed form
 */
function normalizeIPv6(ip: string): string | null {
  // Handle :: abbreviation
  if (ip === '::') return '::';

  let expanded = ip;

  // Expand :: to full zero groups
  if (ip.includes('::')) {
    const parts = ip.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - left.length - right.length;

    if (missing < 0) return null; // Too many groups

    const zeros = new Array(missing).fill('0');
    expanded = [...left, ...zeros, ...right].join(':');
  }

  const groups = expanded.split(':');
  if (groups.length !== 8) return null;

  // Normalize each group (remove leading zeros, lowercase)
  const normalized = groups.map(g => {
    const hex = g.replace(/^0+/, '') || '0';
    if (!/^[0-9a-f]{1,4}$/i.test(hex)) return null;
    return hex.toLowerCase();
  });

  if (normalized.some(g => g === null)) return null;

  // Compress back to shortest form
  return compressIPv6(normalized.join(':'));
}

/**
 * Compress IPv6 to shortest valid form
 */
function compressIPv6(ip: string): string {
  // Find longest run of zeros to replace with ::
  const groups = ip.split(':');

  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  let currentLength = 0;

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === '0') {
      if (currentStart === -1) {
        currentStart = i;
        currentLength = 1;
      } else {
        currentLength++;
      }

      if (currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
    } else {
      currentStart = -1;
      currentLength = 0;
    }
  }

  // Only compress if we have 2+ consecutive zeros
  if (bestLength >= 2) {
    const left = groups.slice(0, bestStart).join(':');
    const right = groups.slice(bestStart + bestLength).join(':');

    if (!left && !right) return '::';
    if (!left) return '::' + right;
    if (!right) return left + '::';
    return left + '::' + right;
  }

  return ip;
}

/**
 * Extract IP from CIDR notation
 */
export function extractIPFromCIDR(cidr: string): string | null {
  const parts = cidr.split('/');
  if (parts.length !== 2) return null;
  return normalizeIP(parts[0]);
}

/**
 * Get CIDR prefix length
 */
export function getCIDRPrefix(cidr: string): number | null {
  const parts = cidr.split('/');
  if (parts.length !== 2) return null;
  const prefix = parseInt(parts[1], 10);
  return isNaN(prefix) ? null : prefix;
}
