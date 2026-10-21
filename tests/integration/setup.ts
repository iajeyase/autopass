// Globaler Testaufbau: Migrationen auf die Testdatenbank anwenden.
import { applyMigrations } from './helpers';

export default async function setup(): Promise<void> {
  await applyMigrations();
}
