import Link from 'next/link';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

export function cn(...values: Parameters<typeof clsx>): string {
  return twMerge(clsx(values));
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-foreground hover:opacity-90 shadow-sm',
  secondary: 'bg-surface text-foreground border border-border hover:bg-surface-muted',
  ghost: 'text-accent hover:bg-accent-soft',
  danger: 'bg-danger text-white hover:opacity-90',
};

const BUTTON_BASE =
  'transition-soft inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

export function buttonClass(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className);
}

export function LinkButton({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  title,
  description,
  action,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  tone?: 'default' | 'demo';
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-surface p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        tone === 'demo' ? 'border-demo/40' : 'border-border',
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'demo';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  demo: 'bg-demo-soft text-demo',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

const ALERT_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
  demo: ShieldAlert,
} as const;

const ALERT_TONE: Record<keyof typeof ALERT_ICON, string> = {
  info: 'border-accent/30 bg-accent-soft text-foreground',
  success: 'border-success/30 bg-success-soft text-foreground',
  warning: 'border-warning/40 bg-warning-soft text-foreground',
  danger: 'border-danger/30 bg-danger-soft text-foreground',
  demo: 'border-demo/40 bg-demo-soft text-foreground',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_ICON;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = ALERT_ICON[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-4 text-sm', ALERT_TONE[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-foreground/85')}>{children}</div>}
      </div>
    </div>
  );
}

export function DemoBadge({ children = 'Demo-Simulation' }: { children?: ReactNode }) {
  return <Badge tone="demo">{children}</Badge>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

export function Definition({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
