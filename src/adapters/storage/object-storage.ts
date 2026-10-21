import { env } from '@/lib/env';
import { getObject as getLocal, putObject as putLocal } from './local-storage';
import { getObjectS3, putObjectS3 } from './s3-storage';

// Einziger Einstieg für Dokumentspeicher. Die Wahl trifft STORAGE_DRIVER.
// Lokaler Speicher ist auf Serverless-Plattformen (Vercel) nicht dauerhaft und wird dort abgelehnt.
function assertDriverUsable(): void {
  if (env().STORAGE_DRIVER === 'local' && process.env.VERCEL && !env().ALLOW_LOCAL_STORAGE_ON_VERCEL) {
    throw new Error('STORAGE_DRIVER=local ist auf Vercel nicht zulässig. Bitte S3-kompatiblen Speicher konfigurieren.');
  }
}

export async function putObject(content: Buffer): Promise<string> {
  assertDriverUsable();
  return env().STORAGE_DRIVER === 's3' ? putObjectS3(content) : putLocal(content);
}

export async function getObject(key: string): Promise<Buffer> {
  assertDriverUsable();
  return env().STORAGE_DRIVER === 's3' ? getObjectS3(key) : getLocal(key);
}
