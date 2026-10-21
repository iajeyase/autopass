# 07 · Deployment: Vercel und Alternativen

Dieses Dokument beschreibt, wie AutoPass öffentlich erreichbar wird. Es unterscheidet zwischen **technisch deploybar** und **öffentlich launchbar**.

## Was Vercel übernimmt und was nicht

| Bestandteil | Vercel | Anmerkung |
|---|---|---|
| Next.js-Anwendung, Server Actions, API-Routen | Ja | Automatisch erkannt |
| Build und Migrationen | Ja | `vercel-build` führt `prisma migrate deploy` aus |
| Cron-Aufruf für Aufgaben | Ja | `vercel.json`: täglich (Hobby) bzw. minütlich (Pro) |
| PostgreSQL | Nein | Extern, z. B. Neon über den Vercel Marketplace |
| Dokumentspeicher | Nein | Lokales Dateisystem ist auf Vercel flüchtig und wird abgelehnt. S3-kompatibler Speicher ist Pflicht |
| Dauerhafter Worker-Prozess | Nein | Serverless kennt keine Hintergrundprozesse. Der Cron-Aufruf reicht für den Pilot, produktiv besser ein Container-Dienst |
| Request-Grösse | Begrenzt | Ca. 4,5 MB pro Anfrage. Dokumente über 4 MB sind über Vercel nicht zuverlässig hochladbar |

## Entscheidung in einem Satz

Vercel hostet die Anwendung. Die Datenbank liegt bei einem PostgreSQL-Anbieter, die Dateien in einem S3-kompatiblen Bucket.
Der Worker läuft im Pilot über den Vercel-Cron, danach über einen Container-Dienst (Dockerfile liegt bei).

## Schritt für Schritt

### 1. Code auf GitHub bringen

Vercel importiert ausschliesslich Git-Repositorien.

```bash
git push -u origin claude/autopass-switzerland-021ljm
```

Für den Push muss die Claude-GitHub-App auf dem Repository installiert und das Konto verbunden sein
(https://claude.ai/connect-github). Vercel verlangt außerdem, dass das GitHub-Konto mit Vercel verbunden ist (Import-Dialog bei Vercel).
Für den Live-Betrieb empfehlen sich `main` als Produktionsbranch und ein Pull-Request-Prozess.

### 2. PostgreSQL anlegen

Empfehlung: Neon (Serverless Postgres, Vercel Marketplace oder direkt). Anlegen einer Datenbank mit Region **Frankfurt** oder **Zürich**, sofern verfügbar, damit Daten in der Schweiz bzw. EU bleiben. Die Verbindungs-URL im Format `postgresql://…?sslmode=require` kopieren.

Hinweis: Migrationen laufen beim Build über dieselbe `DATABASE_URL`. Dafür eine direkte (nicht gepoolte) URL verwenden.

### 3. S3-kompatiblen Bucket anlegen

Geeignet sind AWS S3 (Region `eu-central-2` Zürich oder `eu-central-1` Frankfurt), Cloudflare R2 oder ein anderer S3-Anbieter.

- Bucket **privat** anlegen, kein öffentlicher Zugriff.
- Zugriffsschlüssel mit Rechten nur auf diesen Bucket erstellen.
- Bei R2 oder MinIO: Endpunkt-URL in `S3_ENDPOINT` eintragen. Bei AWS leer lassen.

### 4. Geheimnisse erzeugen

```bash
openssl rand -hex 32    # für INSURANCE_DEMO_WEBHOOK_SECRET (mindestens 32 Zeichen)
openssl rand -hex 24    # für CRON_SECRET (mindestens 16 Zeichen)
```

### 5. Vercel-Projekt anlegen

1. Auf vercel.com das Repository über **Add New → Project** importieren.
2. Framework „Next.js“ wird erkannt. Build-Befehl nicht ändern. Vercel nutzt das Skript `vercel-build`.
3. Umgebungsvariablen eintragen (siehe Tabelle unten). **Environment: Production.**
4. **Deploy** klicken.

### 6. Umgebungsvariablen (Production)

| Variable | Wert | Pflicht |
|---|---|---|
| `APP_ENV` | `production` | Ja |
| `DEMO_MODE` | `false` | Ja (Produktion verbietet `true`) |
| `DATABASE_URL` | Neon-URL | Ja |
| `APP_BASE_URL` | `https://<deine-domain>` | Nein auf Vercel (Fallback: Produktions-URL des Projekts). Eigene Domain später setzen |
| `STORAGE_DRIVER` | `s3` | Ja |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | aus Schritt 3 | Ja |
| `S3_ENDPOINT` | nur bei R2/MinIO | Nein |
| `INSURANCE_DEMO_WEBHOOK_SECRET` | aus Schritt 4, mind. 32 Zeichen | Ja |
| `CRON_SECRET` | aus Schritt 4 | Ja, wenn Cron genutzt wird |
| `MAX_UPLOAD_BYTES` | `4000000` | Empfohlen (Vercel-Grenze) |
| `SESSION_TTL_HOURS` | `12` | Optional |

Die Anwendung startet bzw. baut nicht, wenn Produktionswerte fehlen oder unsicher sind. Die Fehlermeldung nennt dann den Grund.
Das ist beabsichtigt.

### 7. Datenbank einrichten

Migrationen laufen automatisch im Build. Danach ist die Datenbank leer. **Keine Demo-Daten in die Produktionsdatenbank einspielen.**

Den ersten Administrator legt man derzeit über die Datenbank an, da es keine Oberfläche dafür gibt:

```sql
-- Nach Registrierung des Kontos über die Oberfläche
UPDATE "User" SET "platformRole" = 'ADMIN' WHERE email = 'du@beispiel.ch';
```

Ein Operations-Konto wird analog mit `'OPERATOR'` angelegt.

### 8. Cron für Aufgaben

`vercel.json` enthält den Aufruf `/api/cron/worker` täglich um 06:00 UTC. Vercel sendet den Header `Authorization: Bearer <CRON_SECRET>`.
Im Hobby-Tarif ist nur ein täglicher Lauf erlaubt, im Pro-Tarif minütlich. Für Versicherungsanfragen mit kurzen Wartezeiten ist der Pro-Tarif oder der Worker-Container sinnvoll.

### 9. Domain

Im Projekt unter **Settings → Domains** die eigene Domain eintragen und den DNS-Eintrag setzen. `APP_BASE_URL` muss exakt dieser Domain entsprechen.

### 10. Demo getrennt betreiben

Für Vorführungen eine **zweite** Umgebung verwenden, nicht die Produktion:

- Eigenes Vercel-Projekt oder Environment „Preview“ mit `APP_ENV=demo`, `DEMO_MODE=true` und einer eigenen Datenbank.
- Dort einmalig `npm run db:seed` gegen diese Datenbank ausführen.
- Die Demo-Umgebung nicht öffentlich indexieren lassen (`noindex` bzw. Zugriffsschutz über Vercel Deployment Protection).

## Fehlersuche

**Build bricht ab mit „Ungültige Konfiguration: APP_BASE_URL … CRON_SECRET …“**
- Leere Variablen zählen als ungesetzt. Entweder den Wert eintragen oder die Variable ganz löschen.
- `CRON_SECRET` braucht mindestens 16 Zeichen, sonst weglassen.
- `APP_BASE_URL` muss mit `https://` beginnen. Ohne Eintrag wird die Produktions-URL genutzt.

**Build bricht ab mit „Produktionskonfiguration unvollständig“**
- Meldung nennt die fehlenden Punkte. Typisch: `INSURANCE_DEMO_WEBHOOK_SECRET` noch auf dem Standardwert, `DEMO_MODE` steht auf `true`, oder S3-Zugangsdaten fehlen.

**Migrationen schlagen fehl**
- `DATABASE_URL` prüfen. Die Datenbank muss erreichbar sein und die Verbindung mit `sslmode=require` erlauben.

## Lokaler Test des Vercel-Builds

```bash
npm run vercel-build   # Prisma generate, migrate deploy, next build
npm run start
```

## Nach dem Deployment prüfen

- [ ] Startseite lädt, Impressum und Datenschutz zeigen den Entwurfshinweis.
- [ ] Registrierung und Anmeldung funktionieren.
- [ ] Kein Demo-Banner sichtbar, Demo-Konten sind nicht vorhanden.
- [ ] Dokument-Upload bis 4 MB funktioniert, Download liefert die Datei.
- [ ] `GET /api/cron/worker` ohne Token antwortet mit 401.
- [ ] `POST /api/webhooks/insurance` ohne gültige Signatur antwortet mit 401.
- [ ] Vercel-Logs zeigen keine Fehler nach Aufruf der Seiten.

## Alternative: Container-Hosting (Render, Railway, Fly.io)

Das Repository enthält ein `Dockerfile` und eine `docker-compose.yml`. Für den Worker-Dienst gilt:

- Image aus dem Dockerfile bauen.
- Dienst `npm run worker` (bzw. `npx tsx scripts/worker.ts`) mit denselben Umgebungsvariablen starten.
- Web-Dienst mit `npx next start` betreiben oder auf Vercel belassen.

Vorteil: dauerhafter Worker ohne Cron-Beschränkung. Der Docker-Build ist im Projekt noch nicht praktisch geprüft.

## Was vor dem öffentlichen Launch noch fehlt

Technisch lässt sich AutoPass nach diesen Schritten betreiben. Öffentlich launchbar ist es erst, wenn folgende Punkte erledigt sind
(vollständige Liste in docs/06):

1. **Rechtliches:** Impressum, Datenschutzerklärung und AGB rechtlich geprüft. Kantonsregeln LU und ZH gegen die amtlichen Quellen verifiziert.
2. **Sicherheit:** E-Mail-Verifizierung bei der Registrierung, MFA für Operations und Administration, Malwarescan für Uploads, Redis-Rate-Limit (Vercel-Instanzen teilen keinen Speicher).
3. **Dokumente:** Echte Texterkennung statt Demo-OCR. Ohne sie bleibt die Dokumentenerfassung manuell.
4. **Betrieb:** Monitoring, Fehlerprotokoll, Backup-Test der Datenbank, Alarm bei fehlgeschlagenen Aufgaben.
5. **Partner:** Mindestens ein Versicherungspartner oder eine schriftliche Vereinbarung mit dem Strassenverkehrsamt für den manuellen Weg.

Bis dahin eignet sich der Betrieb als **geschlossener Pilot** mit eingeladenen Händlern und Testkunden, nicht als öffentliche Plattform.
