// Magic-byte verification for uploaded images. The MIME-type from multer is
// trusted client input — a malicious user can claim image/png while sending a
// php script. We re-derive the format from the first bytes of the buffer and
// reject any mismatch.
//
// Refs:
//   - PNG header (RFC 2083 §3.1):  89 50 4E 47 0D 0A 1A 0A
//   - JPEG SOI + APP marker:       FF D8 FF
//   - WebP RIFF container:         52 49 46 46 ?? ?? ?? ?? 57 45 42 50

import type { ImageMimeType } from './types';

export type SniffedFormat = ImageMimeType | 'unknown';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_SIGNATURE = Buffer.from([0x52, 0x49, 0x46, 0x46]); // "RIFF"
const WEBP_TAG = Buffer.from([0x57, 0x45, 0x42, 0x50]); // "WEBP" at offset 8

/**
 * Returns the MIME type implied by the buffer's first bytes, or `'unknown'`
 * if no supported signature is found. Does NOT throw.
 */
export function sniffImageFormat(buf: Buffer): SniffedFormat {
  if (buf.length >= PNG_SIGNATURE.length && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (buf.length >= JPEG_SIGNATURE.length && buf.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).equals(RIFF_SIGNATURE) &&
    buf.subarray(8, 12).equals(WEBP_TAG)
  ) {
    return 'image/webp';
  }
  return 'unknown';
}
