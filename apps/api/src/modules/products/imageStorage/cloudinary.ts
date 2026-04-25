import type { ImageStorage, UploadContext, UploadInput } from './types';

export interface CloudinaryOptions {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Cloudinary adapter — uploads via the official SDK using a stream.
 * The SDK is imported lazily so projects that never enable cloudinary mode
 * don't pay the dependency cost.
 *
 * NOTE: this adapter is gated by config; without `IMAGE_STORAGE=cloudinary`
 * + the three CLOUDINARY_* env vars, it is never instantiated.
 */
export function buildCloudinaryImageStorage(options: CloudinaryOptions): ImageStorage {
  return {
    async save(input: UploadInput, ctx: UploadContext): Promise<string> {
      // Lazy import — keeps the bundle/install footprint minimal when local mode is used.
      // The `cloudinary` package is intentionally NOT in package.json; consumers who
      // enable IMAGE_STORAGE=cloudinary install it explicitly.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const cloudinaryModule: any = require('cloudinary');
      const cloudinary = cloudinaryModule.v2;

      cloudinary.config({
        cloud_name: options.cloudName,
        api_key: options.apiKey,
        api_secret: options.apiSecret,
      });

      const folder = `surmoda/${ctx.productCode.toUpperCase()}`;

      return new Promise<string>((resolveUpload, rejectUpload) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: 'image' },
          (err: Error | undefined, result: { secure_url: string } | undefined) => {
            if (err) return rejectUpload(err);
            if (!result) return rejectUpload(new Error('Cloudinary upload returned no result'));
            return resolveUpload(result.secure_url);
          },
        );
        stream.end(input.buffer);
      });
    },
  };
}
