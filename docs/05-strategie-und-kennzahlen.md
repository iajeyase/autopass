# 05 · Strategie und Produktkennzahlen

Dieses Dokument beschreibt Differenzierung und Messbarkeit. Es enthält **keine** Produktivkennzahlen, weil es noch keinen Betrieb gibt.

## Differenzierung gegenüber bestehenden Zulassungsdienstleistungen

- **Ein Vorgang über alle Beteiligten:** Käufer, Händler, Versicherung, Behörde und Logistik in einem Status, nicht in Einzelprozessen.
- **Regelbasierte Fallführung:** Anforderungen entstehen aus Fallart und Kanton, nicht aus einem starren Formular.
- **Nachvollziehbarkeit:** Jede Angabe trägt Quelle, Verifizierungsstatus und Zeitpunkt. Ein interner Status wird nie als behördliche Bestätigung ausgegeben.
- **Ehrliche Übergabe:** Die Freigabe nennt die offenen Punkte, statt eine Fertigmeldung zu geben.

## Warum Autohändler regelmässig nutzen sollten

- Der Verkauf wird einmal erfasst. Der Käufer muss die Angaben nicht erneut tippen.
- Der Stand ist für Verkäufer und Käufer derselbe. Rückfragen am Telefon entfallen.
- Fehlende Unterlagen und Verzögerungen erscheinen früh im Dashboard.
- Die Übergabe wird nur angezeigt, wenn sie zulässig ist. Das schützt vor Fehlern am Übergabetag.

## Schnittstellen mit dem grössten Wettbewerbsvorteil (Reihenfolge)

1. **Versicherungsnachweis:** Automatische Anfrage und Statusrückmeldung. Hier entstehen die meisten Wartezeiten.
2. **Behördliche Einreichung:** Verifizierte elektronische Wege je Kanton. Erst danach lässt sich die manuelle Bearbeitung messbar senken.
3. **Händler-Systeme:** Import von Fahrzeugdaten aus dem Garagenverwaltungssystem. Reduziert Erfassungsfehler.
4. **Kontrollschild-Logistik:** Versand und Abholung mit Sendungsverfolgung.

## Partner zuerst

- **Versicherer:** Ein Partner mit hohem Volumen und dokumentierter Schnittstelle, idealerweise mit Sandbox.
- **Strassenverkehrsamt:** Pilot Luzern oder Zürich. Zuerst formelle Vereinbarung über den manuellen Weg, dann elektronische Schnittstelle.
- **Garagen-Netzwerk:** 3 bis 5 Pilotbetriebe mit unterschiedlicher Grösse.

## Automatisierbarkeit

| Prozess | Einschätzung | Begründung |
|---|---|---|
| Verkauf erfassen, Einladung, Kundenbestätigung | Vollständig | Im MVP umgesetzt |
| Fallklassifikation und Anforderungsliste | Weitgehend | Abhängig von verifizierten Regeln |
| Dokumentenerfassung | Teilweise | OCR-Vorschläge, Bestätigung durch Mensch |
| Versicherungsnachweis | Teilweise | Abhängig von Partnerschnittstelle |
| Behördliche Einreichung | Teilweise bis gering | Abhängig von kantonalen Schnittstellen |
| Kontrollschilder und Originale | Gering | Logistik und behördliche Zuteilung |
| Übergabe | Nur Freigabe prüfen, nie automatisch | Rechtlich zwingend belegt |

## Aufgaben für eigene Mitarbeitende oder Dienstleister

- **Eigenes Operations-Team:** Dokumentenverifikation, manuelle Einreichung, Ausnahmen, Kundenkontakt bei Rückfragen.
- **Externe Dienstleister:** Hosting, Versand, OCR, Malwarescan, Identitätsprüfung, Signatur, Logistik.
- **Juristische Beratung:** Regelpflege je Kanton, AGB, Datenschutz.

## Regulatorische Hindernisse vor dem Verkauf

Siehe 04. Vor dem kommerziellen Verkauf sind mindestens geklärt: Regelverifizierung je Kanton, Versicherungsvermittlung, Zahlungsmodell, Datenschutz-Folgenabschätzung, Auftragsbearbeitungsverträge, AGB.

## Kennzahlen (Definition, keine Werte)

Die Kennzahlen sind im Code vorgesehen, werden aber erst mit echten Daten aus dem Betrieb befüllt. Es gibt keine Demowerte für Kennzahlen.

| Kennzahl | Definition | Datenquelle im System | Hinweis |
|---|---|---|---|
| Durchschnittliche Bearbeitungsdauer | Tage von `createdAt` bis `closedAt` abgeschlossener Fälle | `RegistrationCase` | Im Händler-Dashboard als Ø berechnet |
| Zeitersparnis gegenüber Referenzprozess | Vergleich mit gemessener Vorher-Dauer | Messung vor Pilotstart nötig | Nicht im System berechenbar ohne Referenzwert |
| Anteil vollständig beim ersten Einreichen | Fälle, die ohne Nachforderung in `AUTHORITY_PROCESSING` gelangen | `WorkflowEvent` (`MORE_DOCUMENTS_REQUESTED`) | Auszuwerten |
| Anteil manueller Interventionen | Fälle mit mindestens einer Prüfung vom Typ `MANUAL_CHECK` oder `EXCEPTION` | `ReviewItem` | Datenbasis vorhanden |
| Fehlerquote bei Dokumenten | Anteil Dokumente mit `REJECTED` oder Feldkorrektur `CORRECTED` | `Document`, `DocumentExtractionField` | Datenbasis vorhanden |
| Bearbeitungskosten pro Fall | Personalstunden und Fremdkosten je Fall | Nicht im System | Erfassung extern nötig |
| Kundenzufriedenheit | Befragung nach Übergabe | Nicht im System | Befragungsprozess festlegen |
| Anzahl aktiver Händler | Organisationen mit mindestens einem Verkauf in 30 Tagen | `Organization`, `VehicleSale` | Auszuwerten |
| Wiederkehrende B2B-Umsätze | Umsatz je Händler über Monate | Nicht im System (Abrechnung fehlt) | Abrechnungsmodul nötig |
