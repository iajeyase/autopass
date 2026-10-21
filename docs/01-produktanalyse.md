# 01 · Produktanalyse

Stand: Oktober 2026 · Status: MVP-Entwicklungsstand (Demo-fähig, nicht produktiv)

## Produktdefinition

AutoPass Switzerland ist eine digitale Vermittlungs- und Orchestrierungsplattform für Fahrzeugzulassungen in der Schweiz.
Sie koordiniert Käufer, Händler, Versicherung, Dokumentenprüfung und die Einreichung bei der zuständigen Stelle.

**Abgrenzung:** AutoPass ist keine Zulassungsbehörde. Die Plattform erteilt keine Zulassung, keine Kontrollschilder und keine Verkehrsberechtigung.
Jede behördliche Aussage stammt von der zuständigen Stelle und wird manuell oder über einen freigegebenen Partner erfasst.

**Produktversprechen:** Ein Fahrzeug kaufen, einen zentralen digitalen Prozess durchlaufen und möglichst schnell legal damit fahren können.
Eine Bearbeitungsdauer wird nicht zugesagt.

## Rollen

| Rolle | Zweck im MVP |
|---|---|
| Privatkunde (Käufer, Halter) | Einladung annehmen, Kauf als Prozess bestätigen, Dokumente hochladen, Stand verfolgen |
| Autohändler | Verkauf erfassen, Käufer einladen, Team verwalten, Übergabe bestätigen |
| Unternehmenskäufer | Im MVP als Käuferfirma mit Vertretungsprüfung; Freigabeworkflow mit mehreren Personen ist vorbereitet, nicht umgesetzt |
| Operations-Team (AutoPass) | Dokumente verifizieren, Versicherung bestätigen, Einreichung erfassen, Ausnahmen bearbeiten |
| Administrator | Regelwerke, Systemzustand, Audit-Protokoll |
| Versicherung, Behörde, Logistik | Keine eigenen Benutzerkonten. Anbindung über Adapter oder manuell erfasste Belege |

## Hauptprozess (Szenario "Händler verkauft Occasion")

1. Händler erfasst Fahrzeug, Käufer, Kanton, Kontrollschildsituation. Der Fall wird klassifiziert.
2. Händler erzeugt einen zeitlich begrenzten Einladungslink. Nur die hinterlegte E-Mail-Adresse kann ihn annehmen.
3. Käufer bestätigt die Angaben als Prozessbestätigung (kein Kaufvertrag).
4. Das System leitet Anforderungen aus dem Kantonsregelwerk ab und startet die Versicherungsanfrage.
5. Käufer lädt Dokumente hoch. OCR-Werte sind Vorschläge und werden bestätigt oder korrigiert.
6. Operations prüft Dokumente und Versicherungsnachweis, schliesst manuelle Prüfungen und bereitet die Einreichung vor.
7. Die zuständige Stelle antwortet. Eingangsbestätigung und Zulassungsbestätigung werden mit Referenz erfasst.
8. Übergabe: Erst wenn alle Bedingungen aus realen Quellen erfüllt sind, zeigt die Plattform "Ihr Fahrzeug kann übergeben werden."

## MVP-Scope

**Umgesetzt und getestet**
- Registrierung, Login, Sessions, Rollen, Mandantentrennung auf Objektebene
- Verkauf, Einladung, Prozessbestätigung, Kundenprofil
- Dokumenten-Upload mit Dateiprüfung, Versionierung, Extraktion als Vorschlag, VIN-Konfliktprüfung, Verifikation, Ablehnung
- Kantonsabhängige Regel-Engine (Pilot LU und ZH, beide nicht verifiziert) mit generischem Fallback
- Zustandsmaschine, Freigabe-Gates, Statushistorie, Audit-Log
- Versicherungsstatus mit idempotenter Ereignisverarbeitung (HMAC-signierter Webhook)
- Behördeneinreichung mit manuellem Weg, Referenzerfassung, behördlicher Antwort, vorläufiger Berechtigung (nur manuell)
- Aufgabenwarteschlange mit Wiederholung, Backoff, Dead Letter und erneuter Ausführung
- In-App-Benachrichtigungen, E-Mail nur als Protokoll
- Dashboards für Kunde, Händler, Operations, Administration
- Demo-Szenarien 1 bis 6 mit Seed-Daten, alle Simulationen als solche gekennzeichnet

**Bewusst nicht umgesetzt**
- Echte Behörden-, Versicherungs-, Zahlungs-, Signatur- und Identitätsdienste
- Echte OCR, Malwarescan, E-Mail-Versand
- Zahlungen, Rechnungen, Tarifverwaltung
- Push, SMS, native App, PWA-Offline-Modus
- Flotten-Freigabeworkflow, Leasing, Import-Fälle mit Zoll, Kantonswechsel, Abmeldungen
- Regelpflege über die Oberfläche

## Rechtliche und technische Abhängigkeiten

- Kantonsspezifische Dokumentenlisten, Wiederverwendung von Kontrollschildern, Einreichungswege: **nicht verifiziert** (siehe 04).
- Versicherungsnachweis (eVN): Übermittlung durch die Versicherung an die Behörde. AutoPass erstellt keinen eigenen Nachweis.
- Qualifizierte elektronische Signatur und Identitätsprüfung: nur über autorisierte Dienstleister, nicht im MVP.
- Datenschutz: DSG und kantonale Vorschriften, Datenschutz-Folgenabschätzung erforderlich (siehe 04).
- Zahlungen und Versicherungsvermittlung können zusätzliche aufsichtsrechtliche Anforderungen auslösen (siehe 04).

## Benötigte Partnerschaften

| Partner | Zweck | Status |
|---|---|---|
| Versicherungsgesellschaft oder Vermittler | Versicherungsanfrage, eVN-Übermittlung, Statusereignisse | Partnerzugang erforderlich |
| Strassenverkehrsamt (Pilot LU, ZH) | Einreichung, Antworten, Kontrollschilder | Partnerzugang erforderlich; zunächst manuell |
| Kontrollschildhersteller / Logistik | Herstellung, Versand, Abholung (nie Zuteilung) | Vertrag erforderlich |
| Schweizer Zahlungsdienstleister | Zahlungen, Abrechnung | Vertrag erforderlich, Adapter nur vorbereitet |
| Anbieter für qualifizierte Signatur / Identitätsprüfung | Nur falls rechtlich nötig | Zu klären |
| Malwarescan- und OCR-Anbieter | Produktive Dokumentprüfung | Zu wählen; Adapter vorbereitet |

## Was ist sofort möglich, was erfordert Partnerzugang?

- **Sofort möglich:** Verkauf erfassen, Einladung, Kundenbestätigung, Dokumentenerfassung und -verifikation durch das Team, Fallsteuerung, Übergabe-Gate, Demo-Simulationen.
- **Mit Partnerzugang:** automatische Versicherungsanfrage und Statusrückmeldung, elektronische Einreichung, Behördenantworten, Kontrollschild-Logistik, Zahlungen.
