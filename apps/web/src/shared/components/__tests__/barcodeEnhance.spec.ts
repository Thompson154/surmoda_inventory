import { describe, expect, it } from 'vitest';
import { enhanceBarcodeRgba, pickBestBarcodeValue } from '../barcodeEnhance';

describe('barcodeEnhance', () => {
  it('clears dark outer margins up to the white quiet zone while preserving center bars', () => {
    const width = 40;
    const height = 4;
    const src = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let v = 255;
        if (x < 4 || x >= width - 4) {
          v = 20; // dark background outside white sticker
        } else if (x >= 14 && x <= 25 && x % 2 === 0) {
          v = 20; // barcode bars in the center
        }
        const i = (y * width + x) * 4;
        src[i] = v;
        src[i + 1] = v;
        src[i + 2] = v;
        src[i + 3] = 255;
      }
    }

    const out = enhanceBarcodeRgba(src, width, height);

    // Outer dark margins cleared to white (255)
    expect(out[0]).toBe(255);
    expect(out[(width - 1) * 4]).toBe(255);

    // Center barcode bars remain dark
    expect(out[14 * 4]).toBeLessThan(100);
    // Quiet zone between margin and bars remains white
    expect(out[8 * 4]).toBe(255);
  });

  it('pickBestBarcodeValue skips reads with ASCII control characters', () => {
    expect(pickBestBarcodeValue([{ rawValue: '62201..C\x10' }, { rawValue: '62201CCC5980' }])).toBe(
      '62201CCC5980',
    );

    expect(pickBestBarcodeValue([])).toBeNull();
  });
});
