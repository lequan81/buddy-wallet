/**
 * File validation utilities using magic bytes.
 * Shared by both frontend (pre-upload check) and backend (post-upload verify).
 *
 * Uses Uint8Array for cross-environment compatibility (browser + Bun/Node).
 */

const MAGIC = {
  /** PK header — XLSX/XLS are ZIP-based */
  zip: [0x50, 0x4b],
  /** JPEG/JFIF */
  jpeg: [0xff, 0xd8, 0xff],
  /** PNG */
  png: [0x89, 0x50, 0x4e, 0x47],
  /** GIF87a / GIF89a */
  gif: [0x47, 0x49, 0x46],
  /** RIFF (WebP container) */
  webp: [0x52, 0x49, 0x46, 0x46]
} as const;

function matchesMagic(buf: Uint8Array, sig: readonly number[]): boolean {
  return sig.every((b, i) => buf[i] === b);
}

/**
 * Validate that a file's first bytes match XLSX (ZIP) or CSV (printable ASCII).
 * @param header First 4–12 bytes of the file as Uint8Array
 */
export function isValidSpreadsheetBytes(header: Uint8Array): boolean {
  if (header.length < 4) return false;
  // XLSX/XLS: ZIP PK header
  if (matchesMagic(header, MAGIC.zip)) return true;
  // CSV: all bytes are printable ASCII, tab, or newline
  return header.every((b) => (b >= 0x09 && b <= 0x7e) || b === 0x0a || b === 0x0d);
}

/**
 * Validate that a file's first bytes match a known image format.
 * Supports JPEG, PNG, GIF, WebP, HEIC/HEIF.
 * @param header First 12 bytes of the file as Uint8Array
 */
export function isValidImageBytes(header: Uint8Array): boolean {
  if (header.length < 12) return false;
  for (const sig of [MAGIC.jpeg, MAGIC.png, MAGIC.gif, MAGIC.webp]) {
    if (matchesMagic(header, sig)) return true;
  }
  // HEIC/HEIF: "ftyp" marker at offset 4, brand at offset 8
  const ftyp = String.fromCharCode(...header.slice(4, 8));
  if (ftyp === 'ftyp') {
    const brand = String.fromCharCode(...header.slice(8, 12));
    if (['heic', 'heif', 'mif1', 'heix'].includes(brand)) return true;
  }
  return false;
}
