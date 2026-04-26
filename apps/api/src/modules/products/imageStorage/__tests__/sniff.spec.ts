// Magic-byte verification — confirms each known signature is detected and any
// other content is reported as 'unknown'. The controller layer rejects every
// 'unknown' or MIME-mismatch; this test pins the detection surface.

import { sniffImageFormat } from '../sniff';

describe('sniffImageFormat', () => {
  it('detects a PNG by its 8-byte signature', () => {
    const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64), // arbitrary payload
    ]);
    expect(sniffImageFormat(buf)).toBe('image/png');
  });

  it('detects a JPEG by FFD8FF', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
    expect(sniffImageFormat(buf)).toBe('image/jpeg');
  });

  it('detects a WebP via RIFF + WEBP tag', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // size — irrelevant
      Buffer.from([0x57, 0x45, 0x42, 0x50]), // WEBP
      Buffer.alloc(16),
    ]);
    expect(sniffImageFormat(buf)).toBe('image/webp');
  });

  it('returns unknown for arbitrary content', () => {
    expect(sniffImageFormat(Buffer.from('not an image at all'))).toBe('unknown');
  });

  it('returns unknown for an executable masquerading as image (MZ header)', () => {
    const buf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // Windows PE
    expect(sniffImageFormat(buf)).toBe('unknown');
  });

  it('returns unknown for short buffers (<3 bytes)', () => {
    expect(sniffImageFormat(Buffer.from([0xff, 0xd8]))).toBe('unknown');
    expect(sniffImageFormat(Buffer.alloc(0))).toBe('unknown');
  });

  it('returns unknown for RIFF without WEBP tag (e.g. WAV)', () => {
    const wav = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from([0x57, 0x41, 0x56, 0x45]), // WAVE — not WEBP
    ]);
    expect(sniffImageFormat(wav)).toBe('unknown');
  });
});
