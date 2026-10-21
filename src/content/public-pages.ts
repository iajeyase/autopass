// Inhalte des öffentlichen Webauftritts. Texte sind bewusst sachlich: keine Behördenpartnerschaft,
// keine garantierten Bearbeitungszeiten, keine erfundenen Preise.

export interface ContentSection {
  heading: string;
  paragraphs: string[];
}

export interface ContentPage {
  title: string;
  lead: string;
  sections: ContentSection[];
  draftNotice?: string;
}

export const PUBLIC_PAGES: Record<string, ContentPage> = {
  'so-funktionierts': {
    title: "So funktioniert's",
    lead: 'Vier Schritte vom bestätigten Kauf bis zur Fahrzeugübergabe. Sie müssen nicht selbst herausfinden, welche Stelle wofür zuständig ist.',
    sections: [
      {
        heading: '1. Kauf bestätigen',
        paragraphs: [
          'Ihr Händler erfasst den Verkauf und lädt Sie per Link ein. Sie prüfen Händler, Fahrzeug und Ihre Angaben und bestätigen den Vorgang.',
          'Diese Bestätigung ist eine Prozessbestätigung. Sie ersetzt keinen Kaufvertrag.',
        ],
      },
      {
        heading: '2. Angaben und Dokumente',
        paragraphs: [
          'AutoPass zeigt Ihnen nur die Angaben und Dokumente, die für Ihren konkreten Fall nötig sind. Bereits vorhandene Angaben müssen Sie nicht erneut eingeben.',
          'Dokumente laden Sie direkt vom Smartphone hoch. Erkannte Werte können Sie prüfen und korrigieren.',
        ],
      },
      {
        heading: '3. Versicherung und Einreichung',
        paragraphs: [
          'Die Versicherung wird angefragt oder Ihr bestehender Versicherungsnachweis geprüft. Der Versicherungsnachweis wird durch die Versicherung an die zuständige Stelle übermittelt.',
          'Das AutoPass-Team bereitet die Einreichung vor und erfasst jede Antwort der Behörde mit Referenz.',
        ],
      },
      {
        heading: '4. Fahrzeug übernehmen',
        paragraphs: [
          'AutoPass zeigt "Ihr Fahrzeug kann übergeben werden" erst, wenn alle gesetzlichen und operativen Bedingungen belegt sind.',
          'Bis dahin sehen Sie jederzeit, was noch fehlt und wer es erledigt.',
        ],
      },
    ],
  },
  privatkunden: {
    title: 'Für Privatkunden',
    lead: 'Ein Fahrzeug gekauft? Ihre Zulassung läuft über einen Ort, mit klarem Status.',
    sections: [
      {
        heading: 'Ein Überblick statt Papierstapel',
        paragraphs: [
          'Sie sehen jederzeit den aktuellen Stand, den nächsten Schritt und die zuständige Partei. Jede Angabe trägt einen Verifizierungsstatus.',
        ],
      },
      {
        heading: 'Mehrere Fahrzeuge',
        paragraphs: ['Alle Vorgänge stehen in Ihrem Konto. Dokumente bleiben einem Vorgang zugeordnet und sind nur für Sie und die beteiligten Stellen zugänglich.'],
      },
      {
        heading: 'Ihre Daten',
        paragraphs: ['Wir erfassen nur, was für den konkreten Fall nötig ist. Ausweisdokumente werden nicht ungefragt an externe KI-Dienste übermittelt.'],
      },
    ],
  },
  autohaendler: {
    title: 'Lösungen für Autohändler',
    lead: 'Erfassen Sie den Verkauf einmal. Der Zulassungsprozess läuft danach koordiniert weiter.',
    sections: [
      {
        heading: 'Verkauf in wenigen Minuten',
        paragraphs: ['Fahrzeugdaten, Käuferangaben und Kontrollschildsituation erfassen Sie einmal. Der Fall wird automatisch klassifiziert und mit den passenden Anforderungen angelegt.'],
      },
      {
        heading: 'Probleme früh erkennen',
        paragraphs: ['Ihr Dashboard zeigt fehlende Dokumente, offene Prüfungen und Verzögerungen. Ihre Kundschaft sieht denselben Stand.'],
      },
      {
        heading: 'Mandantentrennung',
        paragraphs: ['Ihre Fälle sind nur für Ihre Organisation sichtbar. Andere Händler haben keinen Zugriff.'],
      },
    ],
  },
  unternehmen: {
    title: 'Lösungen für Unternehmen',
    lead: 'Flotten und Firmenfahrzeuge mit klaren Rollen, Freigaben und einer gesammelten Übersicht.',
    sections: [
      {
        heading: 'Mehrere Mitarbeitende',
        paragraphs: ['Verschiedene Personen können Kauf, Prüfung und Freigabe übernehmen. Die Zuständigkeit ist pro Vorgang nachvollziehbar.'],
      },
      {
        heading: 'Vertretungsnachweise',
        paragraphs: ['Für Firmenfälle prüft das Team Vertretungsnachweise manuell. Welcher Nachweis genügt, hängt vom Kanton und vom Fall ab.'],
      },
    ],
    draftNotice: 'Die Funktionen für Flottenkunden sind im MVP vorbereitet, aber noch nicht produktiv freigegeben.',
  },
  preise: {
    title: 'Preise',
    lead: 'Transparent getrennt: AutoPass-Servicegebühr, behördliche Gebühren, Versicherungsprämie und Versand werden einzeln ausgewiesen.',
    sections: [
      {
        heading: 'Was Sie bezahlen',
        paragraphs: [
          'AutoPass-Servicegebühr pro bearbeitetem Zulassungsfall. Die Höhe wird im Angebot genannt.',
          'Behördliche Gebühren gehen direkt an die zuständige Stelle und werden nicht von AutoPass festgelegt.',
          'Versicherungsprämien werden zwischen Ihnen und der Versicherung vereinbart. AutoPass stellt keine Police aus.',
        ],
      },
      {
        heading: 'Händlerabonnement',
        paragraphs: ['Konfigurierbare Tarife je Organisation. Konkrete Beträge werden im Vertrag festgelegt.'],
      },
    ],
    draftNotice: 'Preisangaben sind Platzhalter. Konkrete Tarife sind noch nicht festgelegt und nicht rechtlich geprüft.',
  },
  faq: {
    title: 'Häufige Fragen',
    lead: 'Die wichtigsten Antworten vorab.',
    sections: [
      {
        heading: 'Ist AutoPass eine Behörde?',
        paragraphs: ['Nein. AutoPass ist ein Vermittlungs- und Koordinationsdienst. Zulassungen und Verkehrsberechtigungen erteilt nur die zuständige Behörde.'],
      },
      {
        heading: 'Kann ich das Fahrzeug nach der Bestätigung sofort fahren?',
        paragraphs: ['Nur wenn die gesetzlichen Voraussetzungen erfüllt sind. Eine Fahrberechtigung ergibt sich aus der Zulassung oder einer von der Behörde ausgestellten vorläufigen Berechtigung.'],
      },
      {
        heading: 'Welche Kantone werden unterstützt?',
        paragraphs: ['Im Pilot: Luzern und Zürich. Für die übrigen Kantone erfassen wir die Daten strukturiert und bearbeiten den Fall manuell.'],
      },
      {
        heading: 'Wie sicher sind meine Dokumente?',
        paragraphs: ['Dokumente werden verschlüsselt übertragen, nur berechtigten Personen angezeigt und mit Zugriffsprotokoll gespeichert.'],
      },
    ],
  },
  kontakt: {
    title: 'Kontakt',
    lead: 'Fragen zur Plattform, Partnerschaften oder Pilotbetrieb.',
    sections: [
      {
        heading: 'Schreiben Sie uns',
        paragraphs: ['Platzhalter-Adresse im Entwicklungsstand: kontakt@autopass.example. Vor dem Betrieb durch die echte Adresse ersetzen.'],
      },
    ],
    draftNotice: 'Kontaktdaten sind Platzhalter.',
  },
  datenschutz: {
    title: 'Datenschutzerklärung',
    lead: 'ENTWURF – nicht rechtlich geprüft.',
    sections: [
      {
        heading: 'Grundsätze',
        paragraphs: [
          'Wir verarbeiten Personendaten nach dem Schweizer Datenschutzgesetz (DSG) und der Datenschutzverordnung (DSV). Die Verarbeitung ist auf den jeweiligen Zulassungsfall beschränkt.',
          'Offene Punkte vor dem Betrieb: Verzeichnis der Bearbeitungstätigkeiten, Datenschutz-Folgenabschätzung, Auftragsbearbeitungsverträge und Speicherfristen.',
        ],
      },
    ],
    draftNotice: 'Entwurf. Vor Veröffentlichung durch Datenschutzberatung prüfen lassen.',
  },
  impressum: {
    title: 'Impressum',
    lead: 'ENTWURF – Angaben sind Platzhalter.',
    sections: [
      {
        heading: 'Anbieter',
        paragraphs: ['Firmenname, Rechtsform, Sitz und UID sind vor dem Betrieb einzutragen.'],
      },
    ],
    draftNotice: 'Entwurf. Platzhalter ersetzen.',
  },
};

export const PUBLIC_SLUGS = Object.keys(PUBLIC_PAGES);
