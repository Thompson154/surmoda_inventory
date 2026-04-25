import { createHash } from 'node:crypto';

const BARCODE_LENGTH = 12;

/**
 * Generates a deterministic 12-char uppercased hex barcode for a product variant.
 * Same `(productCode, size, color)` always yields the same barcode across runs.
 *
 * Color is normalized (trimmed + lowercased) before hashing so that case-only or
 * whitespace-only differences don't produce divergent barcodes.
 */
export function generateBarcode(productCode: string, size: string, color: string): string {
  const normalized = `${productCode.toUpperCase()}|${size}|${color.trim().toLowerCase()}`;
  return createHash('sha256').update(normalized).digest('hex').slice(0, BARCODE_LENGTH).toUpperCase();
}
