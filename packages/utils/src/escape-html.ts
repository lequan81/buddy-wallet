/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts HTML entities: & < > " '
 */
export function escapeHtml(text: string): string {
  if (!text) return text;

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Unescape HTML entities back to characters
 */
export function unescapeHtml(text: string): string {
  if (!text) return text;

  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };

  let result = text;
  Object.entries(map).forEach(([entity, char]) => {
    result = result.replace(new RegExp(entity, 'g'), char);
  });

  return result;
}
