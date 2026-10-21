import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

// S3-kompatibler Speicher (AWS S3, Cloudflare R2, MinIO). Zugriff nur serverseitig mit Zugangsdaten aus der Umgebung.
let client: S3Client | null = null;

function s3(): { client: S3Client; bucket: string } {
  const config = env();
  if (!config.S3_BUCKET || !config.S3_REGION || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
    throw new Error('S3-Speicher ist nicht vollständig konfiguriert (S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).');
  }
  if (!client) {
    client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(config.S3_ENDPOINT),
      credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
    });
  }
  return { client, bucket: config.S3_BUCKET };
}

export async function putObjectS3(content: Buffer): Promise<string> {
  const { client: c, bucket } = s3();
  const key = `${randomUUID()}.bin`;
  await c.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content, ContentType: 'application/octet-stream' }));
  return key;
}

export async function getObjectS3(key: string): Promise<Buffer> {
  const { client: c, bucket } = s3();
  const response = await c.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new Error('Objekt ohne Inhalt.');
  }
  return Buffer.from(await response.Body.transformToByteArray());
}
