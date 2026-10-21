import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';

// Dateispeicher für den MVP. Die Schnittstelle entspricht einem S3-kompatiblen Adapter:
// Objekte werden über zufällige Schlüssel abgelegt, nie über Benutzereingaben im Pfad.
// Produktion: S3/MinIO mit kurzlebigen, signierten Zugriffen (siehe docs/02-architektur.md).

function root(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().STORAGE_DIR);
}

export async function putObject(content: Buffer): Promise<string> {
  const key = `${randomUUID()}.bin`;
  await mkdir(root(), { recursive: true });
  await writeFile(path.join(root(), key), content, { flag: 'wx' });
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  if (!/^[0-9a-f-]{36}\.bin$/.test(key)) {
    throw new Error('Ungültiger Speicherschlüssel.');
  }
  return readFile(path.join(root(), key));
}
