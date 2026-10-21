# AutoPass Switzerland

Digitale Orchestrierung von Fahrzeugzulassungen in der Schweiz. Verkauf, Käufer, Dokumente, Versicherungsnachweis,
Einreichung bei der zuständigen Stelle und Übergabe in einem nachvollziehbaren Prozess.

> **AutoPass ist keine Zulassungsbehörde.** Die Plattform erteilt keine Zulassung, keine Kontrollschilder und keine
> Verkehrsberechtigung. Der Stand ist ein MVP für Demo und Pilotvorbereitung, kein Produktivsystem.

Detaillierte Dokumentation: [docs/](docs/) — Produktanalyse, Architektur, Integrationen, rechtliche Annahmen,
Strategie und Kennzahlen, Status und Fortsetzungsplan.

## Schnellstart (lokal)

Voraussetzungen: Node.js 22, PostgreSQL 16 (oder Docker).

```bash
cp .env.example .env            # Werte bei Bedarf anpassen
npm ci
npx prisma migrate deploy       # Migrationen anwenden (Datenbank muss existieren)
npm run db:seed                 # Demo-Daten anlegen (nur Entwicklung)
npm run dev                     # Anwendung auf http://localhost:3000
npm run worker                  # in einem zweiten Terminal: Hintergrundaufgaben
```

Mit Docker (ohne lokale Datenbank):

```bash
docker compose up -d --build db app worker
docker compose exec app npx prisma migrate deploy
docker compose exec app npx tsx prisma/seed.ts   # optional, nur Demo
```

Ein Produktionsbetrieb setzt `APP_ENV=production` und `DEMO_MODE=false`. Mit `APP_ENV=production` startet die Anwendung nicht, wenn `DEMO_MODE` aktiv ist.

## Demo durchspielen

Alle Demo-Konten nutzen das Passwort `Demo-Passwort-2026` (nur für Demo-Umgebungen, im Seed über `SEED_PASSWORD` änderbar).

| Rolle | Konto | Was zu sehen ist |
|---|---|---|
| Operations | `operator@demo.autopass.example` | Prüfwarteschlange, Dokumente verifizieren, Versicherung und Einreichung steuern, Demo-Simulationen |
| Administrator | `admin@demo.autopass.example` | Regelwerke, Kennzahlen, Audit-Protokoll |
| Händler LU | `haendler.lu@demo.autopass.example` | Übersicht, Verkauf erfassen, Einladung erzeugen, Team |
| Mitarbeitende LU | `mitarbeiterin.lu@demo.autopass.example` | Eingeschränkte Händlersicht |
| Händler ZH | `haendler.zh@demo.autopass.example` | Zweiter Mandant (Mandantentrennung prüfen) |
| Kundin LU | `anna.lu@demo.autopass.example` | Szenarien 1 und 4 |
| Kunde ZH | `bruno.zh@demo.autopass.example` | Szenario 2 (Einladung noch offen, Link im Seed-Log) |
| Firmenkäufer | `carla.flotte@demo.autopass.example` | Szenario 3 (Einladung noch offen, Link im Seed-Log) |

**Szenarien aus dem Seed**

1. **Fahrzeugwechsel mit bestehenden Kontrollschildern (LU):** Dokumente verifiziert, Versicherung in Simulation „in Bearbeitung“. Die Übergabe bleibt gesperrt.
2. **Neuwagen mit neuen Kontrollschildern (ZH):** Einladung offen. Den Link aus dem Seed-Log öffnen, registrieren, Kauf bestätigen.
3. **Firmenkauf mit zwei Fahrzeugen (ZH):** Zwei Verkäufe, beide mit Einladung an dieselbe Person.
4. **Falsch erkannte VIN (LU):** Fahrzeugausweis mit abweichender VIN. Das System erzeugt einen Datenkonflikt, die Verifikation ist gesperrt.
5. **Versicherung nicht bestätigt:** Der Schritt „Einreichung“ ist gesperrt, solange der Nachweis nicht bestätigt ist.
6. **Behördenschnittstelle nicht verfügbar:** Die Einreichung wechselt in die manuelle Bearbeitung. Die Daten bleiben im Protokoll erhalten.

Zum Durchspielen eines kompletten Falls:

1. Als Händler LU einen Verkauf erfassen und den Einladungslink erzeugen.
2. Im anderen Browserfenster den Link öffnen, registrieren, Kauf bestätigen.
3. Als Kunde Dokumente hochladen (Demo-PDFs liegen nach dem Seed in `demo/documents/`) und einreichen.
4. Als Operations die Dokumente verifizieren, Versicherung mit Beleg oder Simulation bestätigen, Fall auf „bereit“ setzen.
5. Einreichung veranlassen, „Fällige Aufgaben jetzt verarbeiten (Demo)“ ausführen, Referenz erfassen, Eingangs- und Zulassungsbestätigung erfassen.
6. Übergabe-Prüfung durchführen. Erst bei realen Quellen zeigt die Oberfläche „Ihr Fahrzeug kann übergeben werden.“
7. Als Händler die Übergabe bestätigen. Der Fall ist abgeschlossen.

## Deployment

Vercel hostet die Anwendung, PostgreSQL und S3-kompatibler Speicher laufen extern. Schritt-für-Schritt-Anleitung: [docs/07-deployment-vercel.md](docs/07-deployment-vercel.md).
Vor einem öffentlichen Launch sind rechtliche und Sicherheitspunkte offen, siehe docs/06.

## Tests

```bash
npm run typecheck               # TypeScript
npm run lint                    # ESLint
npm test                        # Unit-Tests der Domänenlogik (28)
npm run test:integration        # Integrationstests gegen PostgreSQL (34), eigene Testdatenbank autopass_test
npm run build && npx playwright test   # End-to-End, Desktop und Mobile (benötigt Seed-Daten)
```

Die Integrationstests verwenden `TEST_DATABASE_URL` oder `postgresql://autopass:autopass@localhost:5432/autopass_test`
und wenden die Migrationen selbst an. Die Datenbank muss vorher existieren.

## Architektur in Kürze

- **Next.js 16 (App Router)**, React 19, TypeScript, Tailwind CSS 4, Zod, Lucide
- **Modular Monolith:** `domain` (reine Fachlogik), `services` (Anwendungsfälle mit Transaktionen), `adapters` (externe Dienste), `app` (Oberfläche und Routen)
- **PostgreSQL 16** mit Prisma 6 und versionierten Migrationen
- **Worker-Prozess** für Aufgaben mit Retry, Backoff und Dead Letter
- **Zustandsmaschine** für Zulassungsfälle mit Freigabe-Gates und vollständiger Statushistorie
- **Versionierte kantonale Regelwerke**, jede Anforderung speichert ihre Regelversion

Details: [docs/02-architektur.md](docs/02-architektur.md).

## Was ist echt, was ist Simulation

| Bereich | Stand |
|---|---|
| Anmeldung, Sessions, Rollen, Mandantentrennung | Umgesetzt und getestet |
| Zustandsmaschine, Freigabe-Gates, Statushistorie | Umgesetzt und getestet |
| Dokumente: Upload, Prüfung, Versionierung, Verifikation | Umgesetzt. Dateiprüfung über Magic Bytes |
| OCR | **Simulation.** Liest nur Demo-Markierungen, keine echte Texterkennung |
| Malwarescan | **Nicht angebunden.** Status `NOT_SCANNED` wird angezeigt |
| Versicherung | **Simulation** im Demo-Modus. Webhook HMAC-signiert, produktiv nur mit Partner |
| Behördeneinreichung | Manuell mit Referenz. Keine elektronische Schnittstelle |
| Behördenantwort | Manuell erfasst oder **Simulation** (gekennzeichnet) |
| Kantonsregeln | Pilot LU und ZH, **nicht verifiziert** |
| E-Mail | Nur Protokoll, kein Versand |
| Zahlungen, Rechnungen | Nicht umgesetzt |

## Verzeichnisse

```
src/            Anwendung (Oberfläche, Services, Domäne, Adapter)
prisma/         Schema, Migrationen, Seed
scripts/        Worker
tests/          Unit- und Integrationstests
e2e/            Playwright-Tests
docs/           Dokumentation
demo/           Demo-Dokumente (entstehen beim Seed)
```

## Konfiguration

Alle Variablen stehen in [.env.example](.env.example) mit Erläuterung. Geheimnisse gehören nicht ins Repository.
