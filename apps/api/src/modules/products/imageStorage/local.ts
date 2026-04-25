import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import type { ImageStorage, UploadContext, UploadInput } from './types';
import { extensionFromMime } from './types';

export interface LocalStorageOptions {
  /** Absolute path of the directory where images are persisted. */
  baseDir: string;
  /** Public-facing path used by FE consumers; defaults to `imagesTest`. */
  publicPrefix?: string;
}

const DEFAULT_PUBLIC_PREFIX = 'imagesTest';

const SAFE_TOKEN_RE = /[^a-z0-9]+/gi;

function sanitizeToken(value: string): string {
  return value.replace(SAFE_TOKEN_RE, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

export function buildLocalImageStorage(options: LocalStorageOptions): ImageStorage {
  const baseDir = resolve(options.baseDir);
  const publicPrefix = options.publicPrefix ?? DEFAULT_PUBLIC_PREFIX;

  return {
    async save(input: UploadInput, ctx: UploadContext): Promise<string> {
      await mkdir(baseDir, { recursive: true });

      const ext = extensionFromMime(input.mimetype);
      const filename = `${sanitizeToken(ctx.productCode)}-${sanitizeToken(ctx.size)}-${sanitizeToken(
        ctx.color,
      )}-${Date.now()}.${ext}`;

      // Defensive: keep file paths shallow and predictable.
      const safeFilename = basename(filename);
      const fullPath = resolve(baseDir, safeFilename);

      await writeFile(fullPath, input.buffer);

      return `${publicPrefix}/${safeFilename}`;
    },
  };
}
