import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLocalImageStorage } from '../local';

describe('buildLocalImageStorage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'surmoda-imgs-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes a PNG buffer to the configured directory and returns a relative path', async () => {
    const storage = buildLocalImageStorage({ baseDir: tempDir });
    const buffer = Buffer.from('fake-png-bytes');

    const result = await storage.save(
      { buffer, mimetype: 'image/png', originalName: 'foo.png' },
      { productCode: 'JN001', size: '30', color: 'azul' },
    );

    expect(result.startsWith('imagesTest/')).toBe(true);
    expect(result.endsWith('.png')).toBe(true);

    const files = await readdir(tempDir);
    expect(files).toHaveLength(1);
    const persisted = await readFile(join(tempDir, files[0]!));
    expect(persisted.equals(buffer)).toBe(true);
  });

  it('maps MIME types to correct extensions', async () => {
    const storage = buildLocalImageStorage({ baseDir: tempDir });
    const png = await storage.save(
      { buffer: Buffer.from('p'), mimetype: 'image/png', originalName: 'p.png' },
      { productCode: 'A', size: 's', color: 'negro' },
    );
    const jpg = await storage.save(
      { buffer: Buffer.from('j'), mimetype: 'image/jpeg', originalName: 'j.jpg' },
      { productCode: 'A', size: 'm', color: 'negro' },
    );
    const webp = await storage.save(
      { buffer: Buffer.from('w'), mimetype: 'image/webp', originalName: 'w.webp' },
      { productCode: 'A', size: 'l', color: 'negro' },
    );

    expect(png.endsWith('.png')).toBe(true);
    expect(jpg.endsWith('.jpg')).toBe(true);
    expect(webp.endsWith('.webp')).toBe(true);
  });

  it('sanitizes filename tokens (whitespace, accents, special chars)', async () => {
    const storage = buildLocalImageStorage({ baseDir: tempDir });

    const result = await storage.save(
      { buffer: Buffer.from('x'), mimetype: 'image/png', originalName: 'x.png' },
      { productCode: 'J/N!001', size: '30', color: 'azul claro' },
    );

    const filename = result.replace('imagesTest/', '');
    expect(filename).toMatch(/^[a-z0-9_]+-[a-z0-9_]+-[a-z0-9_]+-\d+\.png$/);
  });

  it('uses a custom publicPrefix when provided', async () => {
    const storage = buildLocalImageStorage({ baseDir: tempDir, publicPrefix: 'media/products' });

    const result = await storage.save(
      { buffer: Buffer.from('x'), mimetype: 'image/png', originalName: 'x.png' },
      { productCode: 'A', size: 'm', color: 'negro' },
    );

    expect(result.startsWith('media/products/')).toBe(true);
  });
});
