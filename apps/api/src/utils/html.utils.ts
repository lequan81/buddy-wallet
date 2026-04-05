/**
 * HTML Utilities
 *
 * Provides basic HTML escaping to prevent XSS in email templates and other rendered output.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escapes HTML characters in a string to prevent Cross-Site Scripting (XSS).
 * Extremely important when embedding user-provided data (e.g. names) into emails.
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>"'`=]/g, (match) => ESCAPE_MAP[match] || match);
}
