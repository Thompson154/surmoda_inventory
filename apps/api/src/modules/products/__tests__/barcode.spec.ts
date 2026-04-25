import { generateBarcode } from '../barcode';

describe('generateBarcode', () => {
  it('returns a 12-character uppercase hex string', () => {
    const barcode = generateBarcode('JN001', '30', 'azul');
    expect(barcode).toHaveLength(12);
    expect(barcode).toMatch(/^[0-9A-F]{12}$/);
  });

  it('is deterministic — same inputs produce the same barcode', () => {
    const a = generateBarcode('JN001', '30', 'azul');
    const b = generateBarcode('JN001', '30', 'azul');
    expect(a).toBe(b);
  });

  it('normalizes color (case + whitespace) so equivalent variants share the barcode', () => {
    expect(generateBarcode('JN001', '30', 'Azul')).toBe(generateBarcode('JN001', '30', 'azul'));
    expect(generateBarcode('JN001', '30', '  azul  ')).toBe(generateBarcode('JN001', '30', 'azul'));
  });

  it('uppercases the productCode before hashing', () => {
    expect(generateBarcode('jn001', '30', 'azul')).toBe(generateBarcode('JN001', '30', 'azul'));
  });

  it('produces different barcodes for different sizes or colors', () => {
    const ref = generateBarcode('JN001', '30', 'azul');
    expect(generateBarcode('JN001', '32', 'azul')).not.toBe(ref);
    expect(generateBarcode('JN001', '30', 'negro')).not.toBe(ref);
    expect(generateBarcode('JN002', '30', 'azul')).not.toBe(ref);
  });
});
