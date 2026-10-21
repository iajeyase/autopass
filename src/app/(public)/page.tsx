import { CheckCircle2, FileCheck2, ShieldCheck, Car } from 'lucide-react';
import { LinkButton, Card } from '@/components/ui';

const STEPS = [
  { icon: CheckCircle2, title: 'Kauf bestätigen', text: 'Der Händler lädt Sie ein. Sie prüfen die Angaben und bestätigen den Vorgang.' },
  { icon: FileCheck2, title: 'Unterlagen einreichen', text: 'Wir zeigen Ihnen, welche Dokumente fehlen. Erkannte Werte prüfen Sie selbst.' },
  { icon: ShieldCheck, title: 'Versicherung und Einreichung', text: 'Versicherung, Prüfung und Einreichung laufen koordiniert, jeder Schritt mit Status.' },
  { icon: Car, title: 'Fahrzeug übernehmen', text: 'Sobald alles belegt ist, zeigen wir die Übergabe. Vorher nie.' },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">Pilot: Luzern und Zürich</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Auto gekauft. Den Papierkram übernehmen wir.</h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
            AutoPass koordiniert Versicherung, Dokumente und Fahrzeugzulassung über eine zentrale digitale Plattform – damit Sie Ihr Fahrzeug möglichst schnell und unkompliziert übernehmen können.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/registrieren?type=CUSTOMER" className="h-12">Fahrzeug anmelden</LinkButton>
            <LinkButton href="/autohaendler" variant="secondary" className="h-12">Lösung für Autohändler</LinkButton>
          </div>
          <p className="mt-6 text-xs text-muted">Keine Zusage zu Bearbeitungsdauern. Die Zulassung erfolgt durch die zuständige Behörde.</p>
        </div>
        <Card className="p-6 sm:p-8" title="Ihr Vorgang" description="Beispiel einer Statusanzeige">
          <ol className="space-y-4">
            {['Kauf bestätigt', 'Unterlagen eingereicht', 'Versicherungsnachweis in Bearbeitung', 'Einreichung veranlasst'].map((label, index) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${index < 2 ? 'bg-success-soft text-success' : index === 2 ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-muted'}`}>
                  {index + 1}
                </span>
                <span className={index > 2 ? 'text-muted' : ''}>{label}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="mb-8 text-2xl font-semibold tracking-tight">In vier Schritten zum Fahrzeug</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="h-full">
              <step.icon className="size-6 text-accent" aria-hidden />
              <p className="mt-4 text-xs font-medium text-muted">Schritt {index + 1}</p>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
