# 03 · Integrationen

Jede Integration ist eine Adapter-Schnittstelle mit klarem Ergebnis: `OK`, `NOT_INTEGRATED` oder `TRANSIENT_ERROR`
(`src/adapters/types.ts`). Keine Integration wird als produktiv verfügbar dargestellt, solange keine verifizierte Schnittstelle besteht.

## Einordnung

| Kategorie | Bedeutung | Beispiele im Projekt |
|---|---|---|
| **Echt integriert** | Im Code angebunden und getestet | Lokale Speicherung, E-Mail-Protokoll, Webhook-Verarbeitung mit HMAC |
| **Technisch vorbereitet** | Schnittstelle und Ablauf existieren, Gegenstelle fehlt | Versicherungs-Webhook (produktiv nur mit Partnerschlüssel), Malwarescan-Hook, OCR-Hook |
| **Partnerzugang erforderlich** | Ohne Vertrag und Zugangsdaten nicht nutzbar | Versicherer, Strassenverkehrsamt, Zahlungsdienst, Signatur, Identitätsprüfung |
| **Manuelle Bearbeitung** | Ablauf läuft durch das Operations-Team | Behördeneinreichung, Kontrollschilder, Originaldokumente, Verifikation von Dokumenten |
| **Rechtlich oder technisch ungeklärt** | Vor Umsetzung zu klären | Elektronische Einreichung je Kanton, eVN-Übermittlung im Detail, Verkauf von Kontrollschildern, Zahlungsmodell |

## Übersicht je Adapter

| Adapter | Datei | Stand | Kategorie | Was fehlt für den Live-Betrieb |
|---|---|---|---|---|
| InsuranceProviderAdapter | `adapters/insurance/` | Demo-Versicherer (Simulation), Ereignisverarbeitung mit Idempotenz | Technisch vorbereitet | Vertrag, Partner-API-Dokumentation, eigener Signaturschlüssel, Sandbox-Tests |
| CantonalAuthorityAdapter | `adapters/authority/` | Für alle Kantone `NOT_INTEGRATED`; manueller Weg mit Snapshot | Manuelle Bearbeitung | Verifizierte elektronische Einreichung je Kanton, Partnervertrag |
| DocumentVerificationAdapter (OCR) | `adapters/ocr/demo-ocr.ts` | **Keine echte OCR.** Liest nur eine Demo-Markierung im Dokument | Technisch vorbereitet | OCR-Engine oder Anbieter, Qualitätsprüfung, Evaluation mit Testdokumenten |
| Malwarescan | `adapters/security/malware-scan.ts` | Kein Scanner, Status `NOT_SCANNED` wird sichtbar angezeigt | Technisch vorbereitet | ClamAV-Daemon oder gleichwertig, Quarantäne-Workflow |
| NotificationProvider (E-Mail) | `adapters/notifications/email.ts` | Nur Protokoll, keine Zustellung | Technisch vorbereitet | Transaktionaler Versanddienst, SPF, DKIM, DMARC, Bounce-Behandlung |
| Speicher | `adapters/storage/local-storage.ts` | Lokales Dateisystem mit zufälligen Schlüsseln | Technisch vorbereitet | S3-kompatibler Adapter (MinIO/AWS), signierte Kurzzeit-URLs |
| SignatureProviderAdapter | – | Nicht umgesetzt | Rechtlich ungeklärt | Prüfung, ob für Prozessbestätigung eine qualifizierte Signatur nötig ist; sonst Dienstleister |
| PaymentProviderAdapter | – | Nicht umgesetzt | Partnerzugang erforderlich | Schweizer Zahlungsdienstleister, Modell für behördliche Gebühren als Durchlaufposten |
| LogisticsProviderAdapter (Kontrollschilder, Versand) | – | Nicht umgesetzt, Operations erfasst Versand manuell | Partnerzugang erforderlich | Vertrag mit Hersteller und Logistik, Prozess für Abholung |
| Identitätsprüfung | – | Nicht umgesetzt | Partnerzugang erforderlich | Autorisierter Anbieter, falls Identitätsprüfung rechtlich verlangt wird |

## Adaptervertrag (Prinzipien)

- **Einheitliche Ergebnisform:** `AdapterOutcome<T>` mit drei Zuständen. `NOT_INTEGRATED` erzeugt einen manuellen Prüfauftrag, keine Schein-Anfrage.
- **Idempotenz:** Jede Anfrage trägt einen Schlüssel (`idempotencyKey`). Doppelte Aufgaben werden über den Unique-Index verhindert.
- **Retry:** Nur `TRANSIENT_ERROR` wird wiederholt. Exponentieller Backoff, danach Dead Letter.
- **Timeouts:** Im MVP nicht gesetzt. Vor Live-Anbindung verbindlich je Adapter festlegen (Empfehlung: 10 s für Anfragen, 30 s für Dokumentübertragung).
- **Auditierung:** Jede Partnerinteraktion erzeugt einen `WebhookEvent` oder `AuthorityResponse` mit Quelle und externer ID.
- **Konfigurierbare Verfügbarkeit:** Über `adapterKey` in `InsuranceProvider` und Kantonsregel. Ein Kanton ohne Schnittstelle bleibt manuell.
- **Demo-Kennzeichnung:** Demo-Adapter melden `kind: DEMO_SIMULATION`, Ereignisse tragen die Quelle `SIMULATION`, die Oberfläche zeigt das Badge.

## Versicherungs-Webhook (Vertrag für Partner)

```
POST /api/webhooks/insurance
Header: X-AutoPass-Signature: sha256=<hex HMAC-SHA256 über den Rohkörper>
Body:   { "externalEventId": "evt-123", "caseId": "<uuid>", "status": "CONFIRMED", "note": "optional" }
Antwort: 200 { "status": "PROCESSED" | "DUPLICATE" }
         401 Signatur ungültig · 404 Vorgang unbekannt · 409 Übergang unzulässig · 422 Nutzlast ungültig
```

Zulässige Statuswerte: `IN_PROGRESS`, `CONFIRMED`, `NOT_VERIFIED`, `PROBLEM`. Übergänge folgen `src/domain/insurance-state.ts`.
`CONFIRMED` durch den Partner gilt als reale Quelle, sofern `DEMO_MODE` aus ist.

## Voraussetzungen für eine Live-Anbindung

1. **Vertrag und Sandbox** mit dem Partner, schriftlich bestätigte Schnittstellenbeschreibung (Version, Felder, Fehlercodes).
2. **Schlüsselverwaltung:** pro Partner eigener Schlüssel im Secret-Manager, Rotation dokumentiert.
3. **Netzwerk:** feste Ausgangs-IPs oder mTLS, wo der Partner es verlangt.
4. **Abnahmetests** mit Partnerdaten: Doppelzustellung, verspätete Zustellung, Ablehnung, Teilausfall.
5. **Datenschutz:** Umfang der übermittelten Daten nach Zweckbindung begrenzen, Auftragsbearbeitungsvertrag.

## Hinweis zu Behörden

Eine elektronische Einreichung über eine Schnittstelle wird nur aktiviert, wenn eine verifizierte, zugängliche Schnittstelle des zuständigen Kantons besteht.
Bis dahin erfasst das Operations-Team die Einreichung manuell und trägt die Referenz der zuständigen Stelle ein.
