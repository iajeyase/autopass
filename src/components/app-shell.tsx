import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, FilePlus2, Gauge, LogOut, Shield, Users, UserRound, Home, Briefcase } from 'lucide-react';
import type { Actor } from '@/auth/actor';
import { isAdmin, isOperator } from '@/auth/actor';
import { logoutAction } from '@/app/actions';
import { DemoBadge } from './ui';
import { env } from '@/lib/env';

const MOBILE_GRID: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

export function navFor(actor: Actor): NavItem[] {
  if (isOperator(actor)) {
    const items: NavItem[] = [
      { href: '/operations', label: 'Operations', icon: Gauge },
      { href: '/mitteilungen', label: 'Mitteilungen', icon: Bell },
    ];
    if (isAdmin(actor)) {
      items.push({ href: '/admin', label: 'Administration', icon: Shield });
    }
    return items;
  }
  if (actor.memberships.some((m) => m.organizationType === 'DEALER')) {
    return [
      { href: '/haendler', label: 'Übersicht', icon: Home },
      { href: '/haendler/verkauf/neu', label: 'Neuer Verkauf', icon: FilePlus2 },
      { href: '/haendler/team', label: 'Team', icon: Users },
      { href: '/mitteilungen', label: 'Mitteilungen', icon: Bell },
    ];
  }
  return [
    { href: '/kunde', label: 'Meine Fälle', icon: Briefcase },
    { href: '/kunde/profil', label: 'Profil', icon: UserRound },
    { href: '/mitteilungen', label: 'Mitteilungen', icon: Bell },
  ];
}

export function AppShell({ actor, unreadCount, children }: { actor: Actor; unreadCount: number; children: ReactNode }) {
  const items = navFor(actor);
  const roleLabel = isOperator(actor) ? 'Operations' : actor.memberships.some((m) => m.organizationType === 'DEALER') ? 'Autohändler' : 'Privatkunde';
  const orgName = actor.memberships[0]?.organizationName;
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border bg-surface md:flex md:flex-col md:sticky md:top-0 md:h-dvh">
        <div className="px-5 py-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground text-sm">AP</span>
            AutoPass
          </Link>
          <p className="mt-3 text-xs text-muted">{roleLabel}{orgName ? ` · ${orgName}` : ''}</p>
        </div>
        <nav aria-label="Hauptnavigation" className="flex-1 space-y-1 px-3">
          {items.map((item) => (
            <NavLink key={item.href} item={item} unread={item.href === '/mitteilungen' ? unreadCount : 0} />
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium">{actor.fullName}</p>
          <p className="truncate text-xs text-muted">{actor.email}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="transition-soft flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted hover:text-foreground">
              <LogOut className="size-4" aria-hidden /> Abmelden
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground text-xs">AP</span>
            AutoPass
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="min-h-10 px-2 text-sm text-muted">Abmelden</button>
          </form>
        </header>
        {env().DEMO_MODE && (
          <div className="flex justify-center border-b border-border bg-demo-soft px-4 py-2">
            <DemoBadge>Demo-Modus aktiv · Simulationen sind gekennzeichnet</DemoBadge>
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10">{children}</main>
      </div>

      <nav aria-label="Mobile Navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className={`grid ${MOBILE_GRID[items.length] ?? 'grid-cols-4'}`}>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="transition-soft flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-foreground">
                <span className="relative">
                  <item.icon className="size-5" aria-hidden />
                  {item.href === '/mitteilungen' && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">{unreadCount}</span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({ item, unread }: { item: NavItem; unread: number }) {
  return (
    <Link href={item.href} className="transition-soft flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground">
      <item.icon className="size-4" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {unread > 0 && <span className="rounded-full bg-danger px-2 text-xs text-white">{unread}</span>}
    </Link>
  );
}

