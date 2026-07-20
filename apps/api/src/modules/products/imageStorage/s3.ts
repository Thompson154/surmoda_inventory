import { randomBytes } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ImageStorage, UploadContext, UploadInput } from './types';
import { extensionFromMime } from './types';

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlPrefix: string;
}

export function buildS3ImageStorage(config: S3Config): ImageStorage {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // R2 usually requires this
    forcePathStyle: true,
  });

  return {
    async save(input: UploadInput, ctx: UploadContext): Promise<string> {
      const ext = extensionFromMime(input.mimetype);
      const uuid = randomBytes(16).toString('hex');
      const key = `products/${ctx.productCode}/${ctx.size}_${ctx.color}_${uuid}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimetype,
      });

      await client.send(command);

      const prefix = config.publicUrlPrefix.endsWith('/')
        ? config.publicUrlPrefix
        : `${config.publicUrlPrefix}/`;
      return `${prefix}${key}`;
    },
  };
}
