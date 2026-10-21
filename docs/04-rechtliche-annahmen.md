# 04 · Rechtliche Annahmen und Verifizierungsstatus

**Wichtig:** Dieses Dokument ist keine Rechtsberatung. Es hält Annahmen, Quellen und offene Punkte fest.

## Verifizierungsstand der Quellen

| Quelle | URL | Stand bei Erstellung | Verifiziert |
|---|---|---|---|
| ch.ch – Fahrzeug einlösen | https://www.ch.ch/de/fahrzeuge-und-verkehr/autos-und-andere-fahrzeuge/fahrzeug-einlosen/ | Abruf aus der Entwicklungsumgebung schlug fehl (DNS, kein Zugriff) | **Nein** |
| ASTRA – digitale Fahrzeugzulassung | https://www.astra.admin.ch/de/digitale-fahrzeugzulassung | Nicht abgerufen | **Nein** |
| ASTRA – Verkehrsregeln 2026 | https://www.astra.admin.ch/de/verkehrsregeln-2026 | Nicht abgerufen | **Nein** |
| Strassenverkehrsamt LU – eFahrzeugzulassung | https://strassenverkehrsamt.lu.ch/Digitale_Dienstleistungen/eFahrzeugzulassung | Abruf schlug fehl (DNS) | **Nein** |
| Kanton ZH – Fahrzeuge und Kontrollschilder | https://www.zh.ch/de/mobilitaet/fahrzeuge-kontrollschilder.html | Abruf schlug fehl (DNS) | **Nein** |
| Fedlex-Adresse aus der Projektspezifikation (Zuordnung zum Erlass nicht verifiziert) | https://www.fedlex.admin.ch/eli/cc/2018/783/de | Nicht abgerufen | **Nein** |

**Konsequenz:** Alle Regeln im Seed-Stand tragen `verified: false` und den Status `UNVERIFIED`. Die Quellenverweise sind Prüfgrundlagen, keine geprüften Nachweise.
Der Fall erzeugt für jedes Regelwerk einen offenen Prüfauftrag. Kantonsspezifische Unterschiede (LU, ZH) sind **nicht** erfasst, weil sie ohne Quelle nicht belegbar sind.

## Vor dem Pilot zu verifizieren

1. Dokumentenlisten je Fallart (Erstzulassung, Fahrzeugwechsel mit Schildern, Occasion-Kauf) je Kanton.
2. Wann der Prüfungsbericht 13.20A erforderlich ist und wann nicht.
3. Originalpflicht und zulässige digitale Fassungen des Fahrzeugausweises.
4. Wiederverwendung bestehender Kontrollschilder bei Wechsel und Fristen.
5. Voraussetzungen und Dauer einer vorläufigen Verkehrsberechtigung, falls die Behörde sie ausstellt.
6. Elektronische Einreichungswege je Kanton und deren Zugangsbedingungen.
7. Übermittlung des Versicherungsnachweises: wer übermittelt, in welchem Format, mit welcher Frist.

Jede Prüfung wird mit Datum, Prüfer, Quelle und Gültigkeitsbereich in `CantonRuleset` festgehalten (Felder `sourceCheckedAt`, Regelversion).

## Annahmen im MVP

- AutoPass ist ein Vermittlungs- und Koordinationsdienst. Keine Behörde, keine Versicherungsvermittlung im Sinne eines Versicherungsvermittlers.
- Die Prozessbestätigung des Käufers ist **kein** Kaufvertrag und ersetzt keinen. Sie dokumentiert die Zustimmung zum Zulassungsprozess.
- Der Versicherungsnachweis (eVN) wird durch die Versicherung an die Behörde übermittelt. AutoPass erstellt keinen eigenen Nachweis.
- Kontrollschilder werden nicht frei verkauft. AutoPass koordiniert Herstellung, Bereitstellung und Versand, nur soweit zulässig. Die Zuteilung erfolgt durch die zuständige Stelle.
- Eine Ausstellung vorläufiger Verkehrsberechtigungen durch AutoPass erfolgt nie. Nur Erfassung eines Belegs der Behörde.
- Zahlungen: Behördliche Gebühren werden getrennt von der AutoPass-Servicegebühr ausgewiesen. Ein Durchlaufen fremder Gelder kann zusätzliche Anforderungen auslösen (Zahlungsdienstleistungsrecht, Geldwäschereiprüfung). Nicht im MVP.

## Datenschutz (DSG, DSV, kantonale Vorschriften)

- **Rechtsgrundlage:** Vertragserfüllung und Bearbeitung zum Zweck der Zulassung. Einwilligung für Datenbearbeitung wird in der Prozessbestätigung erfasst.
- **Datenminimierung:** Erfasst nur, was der konkrete Fall braucht. Kundenprofil nur mit Adresse, Kanton und optional Telefon.
- **Zweckbindung:** Dokumente bleiben dem Vorgang zugeordnet. Der Händler sieht Fallunterlagen nur seiner eigenen Organisation.
- **Aufbewahrung und Löschung:** Im MVP nicht umgesetzt. Vor Betrieb festlegen: Aufbewahrung nach Abschluss, Löschung von Ausweisdokumenten nach Verifikation, Audit-Log-Frist.
- **Betroffenenrechte:** Auskunft und Herausgabe müssen organisatorisch abgedeckt werden. Technisch im MVP nur über Dokumentdownload und Profilpflege.
- **Auftragsbearbeitung:** Verträge mit Hosting, E-Mail, OCR, Speicher und jedem Partner erforderlich.
- **Ausweisdokumente:** Werden nicht ungefragt an externe KI-Dienste übermittelt. Der MVP verwendet keine externe KI.
- **Datenschutz-Folgenabschätzung:** Erforderlich, weil Ausweis- und Fahrzeugdaten in grossem Umfang verarbeitet werden. Nicht erstellt.
- **Datenschutzerklärung und Impressum** im Projekt sind Entwürfe und müssen rechtlich geprüft werden.

## Aufsicht und Regulierung

- **Versicherungsvermittlung:** Prüfen, ob die Anfrage bei Versicherungen eine Vermittlungstätigkeit mit Registrierungs- und Informationspflichten auslöst.
- **Zahlungen:** Prüfen, ob AutoPass Gelder für Dritte entgegennimmt. Dann ist ein Zahlungsdienstleister mit passender Lizenz einzubinden.
- **Elektronische Signatur:** Prüfen, ob für die Prozessbestätigung eine Signaturform verlangt wird.
- **Amtliche Nutzung:** Keine Behördenpartnerschaft wird behauptet. Vor jeder Darstellung als Partner ist eine schriftliche Vereinbarung nötig.

## Sicherheit und Haftung

- Keine Garantie für Bearbeitungsdauern. Der Produkttext ist entsprechend formuliert.
- Ein Vorgang gilt erst als bestätigt, wenn die Bestätigung aus einer belegbaren Quelle stammt. Simulationen sind nie reale Bestätigungen.
- Haftungsbegrenzung und AGB sind vor Betrieb rechtlich zu erstellen.
