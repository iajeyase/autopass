import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert } from './ui';
import { LinkButton } from './ui';

const NAV = [
  { href: '/so-funktionierts', label: "So funktioniert's" },
  { href: '/privatkunden', label: 'Privatkunden' },
  { href: '/autohaendler', label: 'Autohändler' },
  { href: '/unternehmen', label: 'Unternehmen' },
  { href: '/preise', label: 'Preise' },
  { href: '/faq', label: 'FAQ' },
];

export function PublicShell({ children, demo }: { children: ReactNode; demo: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground text-sm">AP</span>
            AutoPass
          </Link>
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-6 text-sm text-muted lg:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="transition-soft hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/anmelden" className="hidden text-sm font-medium text-accent sm:inline-flex sm:px-3 sm:py-2">
              Anmelden
            </Link>
            <LinkButton href="/registrieren" className="min-h-10 px-3.5 text-sm">
              Konto erstellen
            </LinkButton>
          </div>
        </div>
      </header>
      {demo && (
        <div className="bg-demo-soft">
          <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs font-medium text-demo sm:px-6">
            Demo-Modus: Versicherungs- und Behördenereignisse sind simuliert und als solche gekennzeichnet.
          </p>
        </div>
      )}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <Alert tone="info">
            AutoPass ist keine Zulassungsbehörde. Zulassungen, Kontrollschilder und Verkehrsberechtigungen erteilen ausschliesslich die zuständigen Stellen.
          </Alert>
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
            <p>© AutoPass Switzerland · Entwicklungsstand</p>
            <nav aria-label="Rechtliches" className="flex gap-5">
              <Link href="/kontakt" className="hover:text-foreground">Kontakt</Link>
              <Link href="/datenschutz" className="hover:text-foreground">Datenschutz (Entwurf)</Link>
              <Link href="/impressum" className="hover:text-foreground">Impressum (Entwurf)</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
