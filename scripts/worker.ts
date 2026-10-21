// Hintergrundprozess: verarbeitet fällige Aufgaben (Versicherungsanfragen, Einreichungen) mit Retry und Dead Letter.
// Start: npm run worker. Mehrere Instanzen sind möglich, da jede Aufgabe atomar beansprucht wird.
import { db } from '../src/lib/db';
import { processDueTasks } from '../src/services/worker';

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 5000);
let running = true;

async function loop(): Promise<void> {
  while (running) {
    try {
      const summary = await processDueTasks();
      if (summary.claimed > 0) {
        console.info(`[worker] beansprucht=${summary.claimed} erledigt=${summary.done} wiederholt=${summary.retried} dead_letter=${summary.deadLettered}`);
      }
    } catch (error) {
      console.error('[worker] Lauf fehlgeschlagen', error);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

function shutdown(): void {
  running = false;
  void db.$disconnect().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.info(`[worker] gestartet, Intervall ${INTERVAL_MS} ms`);
void loop();
