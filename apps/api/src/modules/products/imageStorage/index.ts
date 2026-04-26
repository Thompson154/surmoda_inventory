import { resolve } from 'node:path';
import type { AppConfig } from '../../../infrastructure/config';
import { buildCloudinaryImageStorage } from './cloudinary';
import { buildLocalImageStorage } from './local';
import type { ImageStorage } from './types';

export type { ImageMimeType, ImageStorage, UploadContext, UploadInput } from './types';
export { ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES, extensionFromMime } from './types';
export { sniffImageFormat } from './sniff';
export type { SniffedFormat } from './sniff';

/**
 * Builds the image storage adapter from app config.
 * Selection: `IMAGE_STORAGE=cloudinary` → Cloudinary adapter; otherwise local.
 *
 * For the local adapter, the destination directory defaults to
 * `<repo-root>/imagesTest` (resolved relative to the api workspace cwd).
 */
export function buildImageStorage(config: AppConfig): ImageStorage {
  if (config.IMAGE_STORAGE === 'cloudinary') {
    return buildCloudinaryImageStorage({
      cloudName: config.CLOUDINARY_CLOUD_NAME!,
      apiKey: config.CLOUDINARY_API_KEY!,
      apiSecret: config.CLOUDINARY_API_SECRET!,
    });
  }

  const baseDir = config.IMAGE_STORAGE_LOCAL_DIR ?? resolve(process.cwd(), '..', '..', 'imagesTest');
  return buildLocalImageStorage({ baseDir });
}
