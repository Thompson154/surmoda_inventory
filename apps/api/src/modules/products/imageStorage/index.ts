import { resolve } from 'node:path';
import type { AppConfig } from '../../../infrastructure/config';
import { buildCloudinaryImageStorage } from './cloudinary';
import { buildLocalImageStorage } from './local';
import { buildS3ImageStorage } from './s3';
import type { ImageStorage } from './types';

export type { ImageMimeType, ImageStorage, UploadContext, UploadInput } from './types';
export { ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES, extensionFromMime } from './types';
export { sniffImageFormat } from './sniff';
export type { SniffedFormat } from './sniff';

/**
 * Builds the image storage adapter from app config.
 * Selection: `IMAGE_STORAGE=cloudinary` → Cloudinary adapter; `s3` -> S3 adapter; otherwise local.
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

  if (config.IMAGE_STORAGE === 's3') {
    return buildS3ImageStorage({
      endpoint: config.S3_ENDPOINT!,
      region: config.S3_REGION!,
      accessKeyId: config.S3_ACCESS_KEY_ID!,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
      bucketName: config.S3_BUCKET_NAME!,
      publicUrlPrefix: config.S3_PUBLIC_URL_PREFIX!,
    });
  }

  const baseDir =
    config.IMAGE_STORAGE_LOCAL_DIR ?? resolve(process.cwd(), '..', '..', 'imagesTest');
  return buildLocalImageStorage({ baseDir });
}
