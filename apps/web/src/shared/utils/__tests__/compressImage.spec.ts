import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressImage, MAX_COMPRESSED_IMAGE_BYTES } from '../compressImage';

describe('compressImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects files larger than 25 MB', async () => {
    const huge = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(huge, 'size', { value: 26 * 1024 * 1024 });
    await expect(compressImage(huge)).rejects.toThrow(/25 MB/);
  });

  it('compresses and scales down via canvas until output is under 95 KB', async () => {
    const smallBlob = new Blob([new Uint8Array(40 * 1024)], { type: 'image/webp' });
    const fakeCtx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => fakeCtx,
          toBlob: (cb: (b: Blob | null) => void) => cb(smallBlob),
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tag);
    });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() }),
    );

    const input = new File([new Uint8Array(2 * 1024 * 1024)], 'camera.jpg', {
      type: 'image/jpeg',
    });
    const res = await compressImage(input);

    expect(res.file.size).toBeLessThanOrEqual(MAX_COMPRESSED_IMAGE_BYTES);
    expect(res.file.type).toBe('image/webp');
    expect(res.file.name).toBe('camera.webp');
    expect(res.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    vi.unstubAllGlobals();
  });
});
