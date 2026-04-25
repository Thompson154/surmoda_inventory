export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface UploadInput {
  buffer: Buffer;
  mimetype: ImageMimeType;
  originalName: string;
}

export interface UploadContext {
  productCode: string;
  size: string;
  color: string;
}

export interface ImageStorage {
  /** Persists the image and returns a stable reference (relative path or absolute URL). */
  save(input: UploadInput, ctx: UploadContext): Promise<string>;
}

export const ALLOWED_MIME_TYPES: ReadonlySet<ImageMimeType> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function extensionFromMime(mime: ImageMimeType): 'png' | 'jpg' | 'webp' {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
  }
}
