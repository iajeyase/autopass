# 06 · Status, Qualität und Fortsetzungsplan

## Was geliefert ist

- Lauffähige Full-Stack-Anwendung mit PostgreSQL, Prisma-Migrationen, Server Actions, API-Routen und Worker.
- Demo-Daten mit sechs Szenarien (siehe README).
- Rollen: Privatkunde, Händler (mit Admin und Mitarbeitenden), Operations, Administrator.
- Vollständiger Kernprozess von der Einladung bis zur Übergabe, mit Gates und Zustandsmaschine.
- Dokumentation: Produktanalyse, Architektur, Integrationen, rechtliche Annahmen, Kennzahlen, Status.

## Verifizierter Stand

Alle Befehle wurden in dieser Umgebung ausgeführt (Ubuntu 24.04, Node 22, PostgreSQL 16, Chromium aus dem Playwright-Paket).

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Typprüfung | `npm run typecheck` | Ohne Fehler |
| Lint | `npm run lint` | Ohne Fehler und Warnungen |
| Unit-Tests | `npm test` | 28 bestanden |
| Integrationstests | `npm run test:integration` | 34 bestanden (gegen eigene Testdatenbank) |
| Produktionsbuild | `npm run build` | Erfolgreich |
| End-to-End | `npx playwright test` | 21 bestanden, 1 übersprungen (Mobile-Navigation nur im Mobile-Projekt) |

**Nicht verifiziert:** `docker compose up` (kein Docker-Daemon in der Entwicklungsumgebung), Versand von E-Mails (nicht implementiert), Verhalten mit echten Partnern.

## Bekannte Einschränkungen

1. **Kantonsregeln nicht verifiziert.** Die amtlichen Quellen waren aus der Entwicklungsumgebung nicht erreichbar. Alle Regeln sind `UNVERIFIED`.
2. **OCR ist nur eine Demo.** Der Adapter liest Markierungen aus den Demo-Dokumenten, keine echte Schrift.
3. **Kein Malwarescan.** Dokumente tragen den Status `NOT_SCANNED`, der in der Oberfläche angezeigt wird.
4. **Keine E-Mail-Verifizierung.** Einladungen binden an die E-Mail-Adresse. Ein Konto mit dieser Adresse kann sich ohne Bestätigung registrieren. Vor Betrieb zwingend nachrüsten.
5. **Keine MFA** für Operations und Administration.
6. **Rate Limit im Speicher.** Wirkt nur in einem Prozess. Mehrere Instanzen brauchen Redis.
7. **Warteschlange in PostgreSQL** statt Redis/BullMQ. Ausreichend für den Pilot, Skalierung später.
8. **Lokaler Dateispeicher** statt S3/MinIO. Zugriff ist authentifiziert, aber nicht signiert.
9. **Keine Verschlüsselung sensibler Felder** über die Datenbank-Verschlüsselung des Betreibers hinaus.
10. **Keine Aufbewahrungs- und Löschregeln** umgesetzt.
11. **Firmenfreigabe** mit mehreren Personen ist nicht umgesetzt. Firmenfälle werden über eine Prüfung markiert.
12. **Kein Zahlungs-, Rechnungs- und Tarifmodul.** Die Tabellen fehlen bewusst, bis das Modell geklärt ist.
13. **Eigene Sessions** statt Auth.js. Die Entscheidung ist bewusst, weil der Umfang klein ist. Auth.js wird bei MFA und Social Login neu bewertet.
14. **Formularbibliothek:** Native Formulare mit Server-Validierung statt React Hook Form. Keine Komponentengenerierung über die shadcn-CLI.
15. **Content Security Policy** erlaubt `unsafe-inline` für Next.js. Nonce-basierte CSP ist vorgesehen.
16. **PWA:** Manifest und Icon vorhanden, kein Service Worker, kein Offline-Modus.
17. **Sprache:** Nur Deutsch (de-CH). Französisch, Italienisch und Englisch sind nicht angelegt.

## Produktionsreife-Checkliste

**Rechtlich und organisatorisch**
- [ ] Kantonsregeln LU und ZH gegen Quellen verifiziert, mit Datum und Prüfer
- [ ] Datenschutz-Folgenabschätzung erstellt
- [ ] Datenschutzerklärung, Impressum, AGB rechtlich geprüft
- [ ] Auftragsbearbeitungsverträge mit allen Dienstleistern
- [ ] Prüfung Versicherungsvermittlung und Zahlungsdienste abgeschlossen
- [ ] Aufbewahrungs- und Löschkonzept beschlossen

**Sicherheit**
- [ ] E-Mail-Verifizierung bei Registrierung
- [ ] MFA für Operations und Administration
- [ ] Redis-basiertes Rate Limit
- [ ] Malwarescan vor Freigabe jedes Uploads
- [ ] S3-kompatibler Speicher mit kurzlebigen, signierten URLs
- [ ] Nonce-basierte Content Security Policy
- [ ] Externer Penetrationstest
- [ ] Verschlüsselung sensibler Felder und Backups
- [ ] Secret-Manager statt Umgebungsvariablen für Partnerschlüssel

**Betrieb**
- [ ] Container-Image mit Docker-Build verifiziert (ausstehend)
- [ ] Worker als separater Dienst überwacht, Alarm bei Dead Letters
- [ ] Monitoring, Fehlerprotokollierung, Verfügbarkeit
- [ ] Backup und Wiederherstellung getestet
- [ ] Logs ohne personenbezogene Daten
- [ ] APP_ENV=production und DEMO_MODE=false im Betrieb geprüft

**Partner**
- [ ] Erster Versicherer mit Sandbox und Abnahmetests
- [ ] Vereinbarung mit Strassenverkehrsamt (Pilot) über den manuellen Weg
- [ ] Zahlungsdienstleister gewählt, falls Zahlungen erhoben werden

## Nächste drei Prioritäten für den Schweizer Pilotbetrieb

1. **Regeln und Behördenweg belegen.** Kantonsregeln LU und ZH gegen die amtlichen Quellen prüfen und Verifizierung dokumentieren. Parallel mit einem Strassenverkehrsamt den manuellen Einreichungsweg schriftlich festlegen. Ohne dies ist kein echter Vorgang abschliessbar.
2. **Sicherheitsbasis für echte Daten.** E-Mail-Verifizierung, MFA für das Team, Malwarescan, S3-Speicher mit signierten URLs und Nachrichten-Versand. Danach Penetrationstest.
3. **Ersten Versicherungspartner anbinden.** Sandbox, signierter Webhook mit eigenem Schlüssel, Abnahmetests für Doppelzustellung und Ablehnung. Erst dann die Versicherungsanfrage als echt betreiben.

## Fortsetzungsplan (technisch)

Die Reihenfolge ist so gewählt, dass jeder Schritt einzeln testbar ist.

1. **Docker verifizieren:** `docker compose up --build` auf einem Host mit Docker, Migration und Seed ausführen, Worker prüfen.
2. **E-Mail-Verifizierung:** Token-Tabelle, Versandadapter, Sperrung vor Verifizierung. Tests für Ablauf und Wiederverwendung.
3. **MFA:** TOTP für `OPERATOR` und `ADMIN`, Wiederherstellungscodes, Tests für Login ohne zweiten Faktor.
4. **Redis:** Rate Limit und optional Queue (BullMQ) hinter dem bestehenden Worker-Interface.
5. **Speicher:** S3-Adapter mit signierten URLs, Migration bestehender Dateien, Tests für abgelaufene Links.
6. **Malwarescan:** ClamAV-Adapter, Status `INFECTED` sperrt Download und Verifikation.
7. **OCR:** Adapter für eine echte Engine, Evaluation auf Testdokumenten mit Konfidenzschwelle und Pflichtbestätigung.
8. **Regelpflege:** Administrator-Ansicht zum Anlegen neuer Regelversionen mit Verifizierungsstatus, Prüfer und Quelle.
9. **Firmenfälle:** Freigabe durch zweite Person (Vier-Augen-Prinzip), Vertretungsnachweise, Tests für Selbstfreigabe.
10. **Zahlungen und Rechnungen:** Modell für Servicegebühr, behördliche Gebühren und Versicherungsprämie getrennt, Rechnungsbelege.
11. **Weitere Sprachen:** Französisch und Italienisch über Nachrichtenkataloge.

## Wie die Demo geprüft wird

Siehe README, Abschnitt „Demo durchspielen“.
