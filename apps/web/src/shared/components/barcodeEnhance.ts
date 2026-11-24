/**
 * Enhances a cropped 1D-barcode image buffer (RGBA) in place / into a new buffer
 * so software decoders (ZXing WASM on iOS/WebKit) can reliably decode barcodes
 * photographed from LCD screens or tags with narrow quiet zones on dark backgrounds.
 *
 * Steps:
 *  1. Convert to grayscale luminance.
 *  2. Auto-stretch contrast based on the central 50% dynamic range + boost contrast.
 *  3. Apply a 1D horizontal sharpen filter to separate thin adjacent bars.
 *  4. Clean dark outer margins on each row up to the first white quiet-zone run.
 */
export function enhanceBarcodeRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixelCount = width * height;
  const lum = new Float32Array(pixelCount);

  for (let i = 0, p = 0; p < pixelCount; i += 4, p += 1) {
    lum[p] = 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
  }

  // Measure dynamic range in the central 50% so outer dark borders don't skew it.
  const xStart = Math.floor(width * 0.25);
  const xEnd = Math.ceil(width * 0.75);
  const yStart = Math.floor(height * 0.25);
  const yEnd = Math.ceil(height * 0.75);

  let minL = 255;
  let maxL = 0;
  for (let y = yStart; y < yEnd; y += 1) {
    const rowOffset = y * width;
    for (let x = xStart; x < xEnd; x += 1) {
      const v = lum[rowOffset + x]!;
      if (v < minL) minL = v;
      if (v > maxL) maxL = v;
    }
  }
  const range = Math.max(maxL - minL, 1);

  // Contrast stretch + boost
  const stretched = new Uint8ClampedArray(pixelCount);
  for (let p = 0; p < pixelCount; p += 1) {
    const norm = ((lum[p]! - minL) / range) * 255;
    const boosted = (norm - 128) * 2.2 + 128;
    stretched[p] = boosted < 0 ? 0 : boosted > 255 ? 255 : boosted;
  }

  const out = new Uint8ClampedArray(src.length);
  const leftLimit = Math.floor(width / 3);
  const rightLimit = Math.floor((2 * width) / 3);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;

    // 1D horizontal sharpen: [ -0.5, 2, -0.5 ]
    for (let x = 0; x < width; x += 1) {
      const c = stretched[rowOffset + x]!;
      let val: number;
      if (x > 0 && x < width - 1) {
        const l = stretched[rowOffset + x - 1]!;
        const r = stretched[rowOffset + x + 1]!;
        val = 2 * c - 0.5 * l - 0.5 * r;
      } else {
        val = c;
      }
      const clamped = val < 0 ? 0 : val > 255 ? 255 : val;
      const idx = (rowOffset + x) * 4;
      out[idx] = clamped;
      out[idx + 1] = clamped;
      out[idx + 2] = clamped;
      out[idx + 3] = 255;
    }

    // Clear dark outer margins on left and right up to the first white quiet-zone run (>= 6px)
    let lx = 0;
    while (lx < leftLimit) {
      const v = out[(rowOffset + lx) * 4]!;
      if (v > 180) {
        let wr = 0;
        while (lx + wr < width && out[(rowOffset + lx + wr) * 4]! > 180) wr += 1;
        if (wr >= 6) break;
      }
      const idx = (rowOffset + lx) * 4;
      out[idx] = 255;
      out[idx + 1] = 255;
      out[idx + 2] = 255;
      lx += 1;
    }

    let rx = width - 1;
    while (rx > rightLimit) {
      const v = out[(rowOffset + rx) * 4]!;
      if (v > 180) {
        let wr = 0;
        while (rx - wr >= 0 && out[(rowOffset + rx - wr) * 4]! > 180) wr += 1;
        if (wr >= 6) break;
      }
      const idx = (rowOffset + rx) * 4;
      out[idx] = 255;
      out[idx + 1] = 255;
      out[idx + 2] = 255;
      rx -= 1;
    }
  }

  return out;
}

/**
 * Picks the cleanest non-empty barcode value from detector results,
 * skipping any partial/corrupted reads containing ASCII control characters.
 */
export function pickBestBarcodeValue(codes: Array<{ rawValue: string }>): string | null {
  if (!codes || codes.length === 0) return null;
  // eslint-disable-next-line no-control-regex
  const clean = codes.find((c) => c.rawValue && !/[\x00-\x1F\x7F]/.test(c.rawValue));
  return clean?.rawValue ?? codes[0]?.rawValue ?? null;
}
